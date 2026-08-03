import { describe, it, expect } from 'vitest';
import {
    analyzeFrequencyBand,
    analyzeLocalFrequency,
    freqContentToHz,
    ampToOscillationRange,
    getAnalysisWindowSize,
    pitchChromaHue,
    hzToMel,
    spectrumHue,
    ANALYSIS_WINDOW_TEMPORAL,
    ANALYSIS_WINDOW_BALANCED,
    ANALYSIS_WINDOW_SPECTRAL,
    SPECTRUM_MIN_HZ,
    SPECTRUM_MAX_HZ,
    SPECTRUM_HUE_SPAN,
} from '~/utils/audio/analysis';

/* Signal fixtures: the analyzers are derivative-energy heuristics, so the
   interesting invariants are their behaviour at the extremes - silence,
   pure DC (no change), and Nyquist-rate alternation (all change). */

const silence = (n: number) => new Float32Array(n);
const dc = (n: number, v = 0.5) => new Float32Array(n).fill(v);
const alternating = (n: number, v = 0.5) => Float32Array.from({ length: n }, (_, i) => (i % 2 === 0 ? v : -v));
const slowSine = (n: number, period = 512, amp = 0.5) =>
    Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / period) * amp);

describe('getAnalysisWindowSize', () => {
    it('maps each resolution to its window', () => {
        expect(getAnalysisWindowSize('temporal')).toBe(ANALYSIS_WINDOW_TEMPORAL);
        expect(getAnalysisWindowSize('balanced')).toBe(ANALYSIS_WINDOW_BALANCED);
        expect(getAnalysisWindowSize('spectral')).toBe(ANALYSIS_WINDOW_SPECTRAL);
    });
});

describe('analyzeFrequencyBand', () => {
    it('returns mid frequency (0.5) for silence', () => {
        expect(analyzeFrequencyBand(silence(4096), 0, 2048)).toBe(0.5);
    });

    it('returns mid frequency for windows too short to analyze', () => {
        expect(analyzeFrequencyBand(dc(4096), 4090, 2048)).toBe(0.5); // only 6 samples left
    });

    it('reads pure DC as fully low-frequency (0)', () => {
        expect(analyzeFrequencyBand(dc(4096), 0, 2048)).toBe(0);
    });

    it('reads Nyquist-rate alternation as fully high-frequency (1)', () => {
        expect(analyzeFrequencyBand(alternating(4096), 0, 2048)).toBe(1);
    });

    it('reads a slow sine as low-frequency-leaning', () => {
        expect(analyzeFrequencyBand(slowSine(4096), 0, 2048)).toBeLessThan(0.2);
    });

    it('floors fractional start indices instead of reading holes', () => {
        const signal = slowSine(4096);
        expect(analyzeFrequencyBand(signal, 100.7, 2048)).toBe(analyzeFrequencyBand(signal, 100, 2048));
    });

    it('stays within [0, 1] for arbitrary signals', () => {
        const noisy = Float32Array.from({ length: 4096 }, (_, i) => (Math.sin(i * 12.9898) * 43758.5453) % 1);
        const v = analyzeFrequencyBand(noisy, 0, 4096);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
    });
});

describe('analyzeLocalFrequency', () => {
    it('returns mid frequency (0.5) for silence', () => {
        expect(analyzeLocalFrequency(silence(64), silence(64), 32)).toBe(0.5);
    });

    it('reads alternation in both channels as fully high-frequency (1)', () => {
        expect(analyzeLocalFrequency(alternating(64), alternating(64), 32)).toBe(1);
    });

    it('reads a slow sine near its peak as low-frequency-leaning', () => {
        const s = slowSine(2048, 1024);
        expect(analyzeLocalFrequency(s, s, 256)).toBeLessThan(0.2); // sin peak: all body, no change
    });

    it('reads a zero crossing as high-frequency (the per-point estimate is local by design)', () => {
        // At a zero crossing even a slow wave is "all change, no amplitude"
        // inside an 8-sample window - this is why per-point oscillation
        // sparkles at crossings rather than tracking the global pitch.
        const s = slowSine(2048, 1024);
        expect(analyzeLocalFrequency(s, s, 1024)).toBeGreaterThan(0.5);
    });

    it('clamps safely at the buffer edges', () => {
        const s = slowSine(64);
        for (const centre of [0, 63, -5, 200]) {
            const v = analyzeLocalFrequency(s, s, centre);
            expect(Number.isFinite(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });
});

describe('freqContentToHz', () => {
    it('maps the extremes to the range bounds', () => {
        expect(freqContentToHz(0)).toBeCloseTo(100);
        expect(freqContentToHz(1)).toBeCloseTo(8000);
    });

    it('is logarithmic: the midpoint is the geometric mean', () => {
        expect(freqContentToHz(0.5)).toBeCloseTo(Math.sqrt(100 * 8000), 6);
    });

    it('honours custom ranges', () => {
        expect(freqContentToHz(0, 20, 20000)).toBeCloseTo(20);
        expect(freqContentToHz(1, 20, 20000)).toBeCloseTo(20000);
    });
});

describe('ampToOscillationRange', () => {
    it('maps the extremes to the amplitude bounds', () => {
        expect(ampToOscillationRange(0)).toBeCloseTo(0.005);
        expect(ampToOscillationRange(1)).toBeCloseTo(0.05);
    });

    it('clamps out-of-range input', () => {
        expect(ampToOscillationRange(-5)).toBeCloseTo(0.005);
        expect(ampToOscillationRange(7)).toBeCloseTo(0.05);
    });
});

describe('pitchChromaHue', () => {
    it('gives a note the same hue in every octave', () => {
        const a1 = pitchChromaHue(55);
        expect(pitchChromaHue(110)).toBeCloseTo(a1, 6);
        expect(pitchChromaHue(220)).toBeCloseTo(a1, 6);
        expect(pitchChromaHue(3520)).toBeCloseTo(a1, 6);
    });

    it('anchors hue 0 at C and treats silence as 0', () => {
        expect(pitchChromaHue(16.3516)).toBeCloseTo(0, 5);
        expect(pitchChromaHue(0)).toBe(0);
        expect(pitchChromaHue(-3)).toBe(0);
    });
});

describe('hzToMel', () => {
    it('matches the textbook anchor points', () => {
        expect(hzToMel(0)).toBe(0);
        expect(hzToMel(700)).toBeCloseTo(2595 * Math.log10(2), 6);
        expect(hzToMel(1000)).toBeCloseTo(1000, 0); // the formula's design point, ~1000.14
    });

    it('is strictly increasing', () => {
        let prev = -1;
        for (const hz of [20, 55, 220, 1000, 4000, 8000, 16000]) {
            const m = hzToMel(hz);
            expect(m).toBeGreaterThan(prev);
            prev = m;
        }
    });
});

describe('spectrumHue', () => {
    it('spans violet (SPECTRUM_HUE_SPAN) at the bass end to red (0) at the top, without wrapping', () => {
        expect(spectrumHue(SPECTRUM_MIN_HZ)).toBeCloseTo(SPECTRUM_HUE_SPAN, 6);
        expect(spectrumHue(SPECTRUM_MAX_HZ)).toBeCloseTo(0, 6);
        expect(SPECTRUM_HUE_SPAN).toBeLessThan(1); // red and violet stay distinct
    });

    it('clamps content outside the endpoints instead of wrapping or overshooting', () => {
        expect(spectrumHue(20)).toBeCloseTo(SPECTRUM_HUE_SPAN, 6);
        expect(spectrumHue(20480)).toBeCloseTo(0, 6);
    });

    it('treats silence as the deep violet end', () => {
        expect(spectrumHue(0)).toBe(SPECTRUM_HUE_SPAN);
        expect(spectrumHue(-10)).toBe(SPECTRUM_HUE_SPAN);
    });

    it('is monotonic: hue falls as frequency rises', () => {
        let prev = 2;
        for (const hz of [30, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000]) {
            const h = spectrumHue(hz);
            expect(h).toBeLessThan(prev);
            prev = h;
        }
    });

    it('reallocates gamut from the near-empty bottom octaves to the mid-band (the mel warp)', () => {
        // vs a log-frequency ramp over the same endpoints: log gives every
        // octave the same 1/9.06 of the span, so the bottom two octaves
        // (30-120 Hz) burn 22% of the gradient on centroids that almost
        // never occur. Mel hands that to the bands music actually visits.
        // Hue falls with frequency, so a band's share is hue(lo) - hue(hi).
        const share = (lo: number, hi: number) => (spectrumHue(lo) - spectrumHue(hi)) / SPECTRUM_HUE_SPAN;
        const logShare = (lo: number, hi: number) => Math.log2(hi / lo) / Math.log2(SPECTRUM_MAX_HZ / SPECTRUM_MIN_HZ);
        expect(share(30, 120)).toBeLessThan(logShare(30, 120) * 0.25); // bottom: 3.7% vs 22%
        expect(share(1000, 4000)).toBeGreaterThan(logShare(1000, 4000) * 1.4); // mid: 32.5% vs 22%
    });
});
