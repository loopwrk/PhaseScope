// Audio Analysis Utilities
import { clamp } from '~/utils/utilities';
import { FFT } from './fft';

// Frequency analysis window sizes (in samples)
export const ANALYSIS_WINDOW_TEMPORAL = 256; // Fast response, good for percussion/transients
export const ANALYSIS_WINDOW_BALANCED = 512; // Balanced time/frequency resolution
export const ANALYSIS_WINDOW_SPECTRAL = 2048; // Detailed frequency, good for sustained tones

export type FrequencyResolution = 'temporal' | 'balanced' | 'spectral';

export const getAnalysisWindowSize = (resolution: FrequencyResolution): number => {
    switch (resolution) {
        case 'temporal':
            return ANALYSIS_WINDOW_TEMPORAL;
        case 'spectral':
            return ANALYSIS_WINDOW_SPECTRAL;
        case 'balanced':
        default:
            return ANALYSIS_WINDOW_BALANCED;
    }
};

/* The "how fast is this signal changing?" estimate behind both the scope trail
   colour (analyzeFrequencyBand) and the per-point oscillation
   (analyzeLocalFrequency): the share of total energy that sits in the
   derivative vs the signal itself, contrast-boosted into 0..1. More change =
   higher frequency content. Silence (negligible total energy) returns the
   neutral mid value. The ratio is scale-invariant, so callers pass their
   change/amplitude sums at whatever scale their silence threshold expects. */
const DERIV_CONTRAST = 3; // stretches the ratio so the 0..1 range is used
const DERIV_SILENCE = 0.001; // below this total energy, the ratio is undefined
const DERIV_MID_FREQ = 0.5; // neutral fallback for silence / too-short windows

const derivativeEnergyRatio = (changeEnergy: number, ampEnergy: number): number => {
    const change = Math.sqrt(changeEnergy);
    const amp = Math.sqrt(ampEnergy);
    const total = change + amp;
    if (total < DERIV_SILENCE) return DERIV_MID_FREQ;
    return clamp((change / total) * DERIV_CONTRAST, 0, 1);
};

// Analyze frequency content over a window using derivative energy (rate of change)
export const analyzeFrequencyBand = (data: Float32Array, startIdx: number, windowLen: number): number => {
    // Ensure integer indices to avoid fractional array access (e.g. data[123.5])
    const safeStartIdx = Math.max(0, Math.floor(startIdx));
    const minSamples = 8;
    const endIdx = Math.min(safeStartIdx + windowLen, data.length);
    const actualLen = endIdx - safeStartIdx;
    if (actualLen < minSamples) return DERIV_MID_FREQ;

    let amplitudeEnergy = 0; // Energy in the signal itself (slow changes)
    let changeEnergy = 0; // Energy in the derivative (fast changes)

    // Calculate energy in signal and its derivative
    for (let i = safeStartIdx; i < endIdx - 1; i++) {
        const sample = data[i] ?? 0;
        const nextSample = data[i + 1] ?? 0;
        const derivative = nextSample - sample; // Rate of change

        amplitudeEnergy += sample * sample;
        changeEnergy += derivative * derivative;
    }

    // Per-sample-normalised energies, so silence is judged at the original scale
    return derivativeEnergyRatio(changeEnergy / actualLen, amplitudeEnergy / actualLen);
};

// Lightweight per-point frequency estimate around a single sample: the same
// derivativeEnergyRatio as analyzeFrequencyBand, but summed over a tiny window
// of the L+R mix (raw sums - no per-sample normalisation needed). Used to drive
// per-point oscillation while frames are built (a full analysis per point would
// be far too expensive).
export const analyzeLocalFrequency = (
    ch0: Float32Array,
    ch1: Float32Array,
    centerIndex: number,
    windowSize: number = 8
): number => {
    const half = windowSize / 2;
    let changeEnergy = 0;
    let ampEnergy = 0;
    for (let m = -half; m < half; m++) {
        const idx = clamp(centerIndex + m, 0, ch0.length - 2);
        const s0 = (ch0[idx] ?? 0) + (ch1[idx] ?? 0);
        const s1 = (ch0[idx + 1] ?? 0) + (ch1[idx + 1] ?? 0);
        const diff = s1 - s0;
        changeEnergy += diff * diff;
        ampEnergy += s0 * s0;
    }
    return derivativeEnergyRatio(changeEnergy, ampEnergy);
};

// Convert normalized frequency content (0-1) to Hz using logarithmic scale

export const freqContentToHz = (freqContent: number, minHz: number = 100, maxHz: number = 8000): number => {
    return minHz * Math.pow(maxHz / minHz, freqContent);
};

// Map normalized amplitude (0-1) to oscillation amplitude range

export const ampToOscillationRange = (
    normalizedAmp: number,
    minAmp: number = 0.005, // Minimum oscillation amplitude (default: 0.005)
    maxAmp: number = 0.05 //  Maximum oscillation amplitude (default: 0.05)
): number => {
    const clampedAmp = clamp(normalizedAmp, 0, 1);
    const range = maxAmp - minAmp;
    return clampedAmp * range + minAmp;
};

// Stereo correlation over a window: +1 mono (L = R), 0 decorrelated,
// -1 anti-phase. The goniometer's readout and the phase-space "width" of
// everything PhaseScope draws. Returns null for silence (undefined ratio).
export const stereoCorrelation = (
    ch0: Float32Array,
    ch1: Float32Array,
    start: number,
    length: number
): number | null => {
    let eL = 0;
    let eR = 0;
    let eLR = 0;
    const end = Math.min(start + length, ch0.length);
    for (let i = Math.max(0, start); i < end; i++) {
        const l = ch0[i] ?? 0;
        const r = ch1[i] ?? 0;
        eL += l * l;
        eR += r * r;
        eLR += l * r;
    }
    return eL > 1e-9 && eR > 1e-9 ? eLR / Math.sqrt(eL * eR) : null;
};

// Pitch-chroma hue: the fractional octave position of a frequency, so the
// full colour wheel cycles once per octave and a note keeps its colour in
// every octave. Reference defaults to C0 (hue 0 = C = red).

const C = 16.3516;
export const pitchChromaHue = (hz: number, refHz: number = C): number => {
    if (!(hz > 0)) return 0;
    return ((Math.log2(hz / refHz) % 1) + 1) % 1;
};

/* ---------- Spectral centroid (a real frequency transform) ----------

   The "centre of mass" of the magnitude spectrum is the textbook one-number
   summary of where a sound sits tonally - low for a bass drone, high for a
   hi-hat - and it is exactly what the per-frame hue wants. Computing it for
   real means a windowed FFT, which the rest of the engine assumed was too
   expensive; but it runs ONCE PER FRAME, next to a per-point loop that already
   does hundreds of trig + HSL conversions, so it is cheap in context.

   createSpectralAnalyzer preallocates the FFT, a Hann window and the re/im
   scratch buffers, so analysing a frame is allocation-free: window the L+R
   mix into the real buffer, transform, take the power-weighted mean bin. */

export interface SpectralAnalyzer {
    /** FFT length in samples (the analysis window). */
    readonly size: number;
    /** Spectral centroid of the windowed L+R mix, in Hz. 0 for silence. */
    centroidHz: (ch0: Float32Array, ch1: Float32Array, startIdx: number, sampleRate: number) => number;
    /** Centroid mapped to 0..1 on a log scale over [minHz, maxHz]; the hue
     *  contract the geometry engine consumes. Silence returns 0.5 (mid). */
    centroid01: (ch0: Float32Array, ch1: Float32Array, startIdx: number, sampleRate: number) => number;
    /** Map a frequency in Hz onto the same 0..1 log scale (over [minHz, maxHz]);
     *  Hz <= 0 returns 0.5. Lets a caller that already has the centroid in Hz
     *  reuse the mapping without running a second transform. */
    hzTo01: (hz: number) => number;
}

export const createSpectralAnalyzer = (size = 2048, minHz = 100, maxHz = 8000): SpectralAnalyzer => {
    const fft = new FFT(size);
    const re = new Float32Array(size);
    const im = new Float32Array(size);
    // Periodic Hann window: tames spectral leakage so a single tone reads as a
    // tight peak rather than a smear that drags the centroid around.
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);

    const half = size >> 1;
    const logRange = Math.log(maxHz / minHz);
    const SILENCE_POWER = 1e-9;

    const centroidHz = (ch0: Float32Array, ch1: Float32Array, startIdx: number, sampleRate: number): number => {
        const start = Math.floor(startIdx);
        const len = ch0.length;
        // Window the mono mix into the real buffer; out-of-range samples (near
        // the track edges) read as zero, i.e. zero-padding.
        for (let i = 0; i < size; i++) {
            const idx = start + i;
            const s = idx >= 0 && idx < len ? 0.5 * ((ch0[idx] ?? 0) + (ch1[idx] ?? 0)) : 0;
            re[i] = s * (window[i] ?? 0);
            im[i] = 0;
        }

        fft.transform(re, im);

        // Power-weighted mean bin. Skip DC (k=0): it carries no pitch and would
        // only pull every centroid toward zero. Weighting by power means no
        // per-bin sqrt is needed - the magnitude scale cancels in the ratio.
        let weighted = 0;
        let total = 0;
        for (let k = 1; k <= half; k++) {
            const power = (re[k] ?? 0) * (re[k] ?? 0) + (im[k] ?? 0) * (im[k] ?? 0);
            weighted += k * power;
            total += power;
        }
        if (total < SILENCE_POWER) return 0;
        return ((weighted / total) * sampleRate) / size;
    };

    // silence / undefined -> mid hue, matching the old proxy
    const hzTo01 = (hz: number): number => (hz > 0 ? clamp(Math.log(hz / minHz) / logRange, 0, 1) : 0.5);

    const centroid01 = (ch0: Float32Array, ch1: Float32Array, startIdx: number, sampleRate: number): number =>
        hzTo01(centroidHz(ch0, ch1, startIdx, sampleRate));

    return { size, centroidHz, centroid01, hzTo01 };
};
