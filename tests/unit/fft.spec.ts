import { describe, it, expect } from 'vitest';
import { FFT } from '~/utils/audio/fft';
import { createSpectralAnalyzer } from '~/utils/audio/analysis';

/* The fast path is only worth anything if it equals the slow, obviously-correct
   one. So the FFT is pinned against a brute-force O(N^2) DFT, and the spectral
   centroid is checked against signals whose answer we know by construction. */

/** Naive forward DFT - the ground truth the FFT must match. */
const naiveDft = (re: Float32Array, im: Float32Array) => {
    const n = re.length;
    const outRe = new Float64Array(n);
    const outIm = new Float64Array(n);
    for (let k = 0; k < n; k++) {
        let sr = 0;
        let si = 0;
        for (let t = 0; t < n; t++) {
            const angle = (-2 * Math.PI * k * t) / n;
            sr += re[t]! * Math.cos(angle) - im[t]! * Math.sin(angle);
            si += re[t]! * Math.sin(angle) + im[t]! * Math.cos(angle);
        }
        outRe[k] = sr;
        outIm[k] = si;
    }
    return { outRe, outIm };
};

const sine = (n: number, hz: number, sr: number, amp = 0.8) =>
    Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr));

describe('FFT', () => {
    it('rejects non-power-of-two sizes', () => {
        expect(() => new FFT(48000)).toThrow();
        expect(() => new FFT(1)).toThrow();
        expect(() => new FFT(2048)).not.toThrow();
    });

    it('matches a brute-force DFT on random input', () => {
        const n = 64;
        const re = Float32Array.from({ length: n }, () => Math.random() * 2 - 1);
        const im = Float32Array.from({ length: n }, () => Math.random() * 2 - 1);
        const ref = naiveDft(re, im);

        const fft = new FFT(n);
        fft.transform(re, im);

        for (let k = 0; k < n; k++) {
            expect(re[k]!).toBeCloseTo(ref.outRe[k]!, 2);
            expect(im[k]!).toBeCloseTo(ref.outIm[k]!, 2);
        }
    });

    it('puts a pure tone in the expected bin', () => {
        // A sine at an integer bin should concentrate energy there
        const n = 1024;
        const bin = 32;
        const re = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * bin * i) / n));
        const im = new Float32Array(n);
        new FFT(n).transform(re, im);

        const power = (k: number) => re[k]! * re[k]! + im[k]! * im[k]!;
        let peak = 1;
        for (let k = 1; k < n / 2; k++) if (power(k) > power(peak)) peak = k;
        expect(peak).toBe(bin);
    });
});

describe('createSpectralAnalyzer', () => {
    const sr = 48000;
    const analyzer = createSpectralAnalyzer(2048);

    it('reports a pure tone near its true frequency', () => {
        const tone = sine(8192, 1000, sr);
        const hz = analyzer.centroidHz(tone, tone, 2048, sr);
        // Within a couple of FFT bins (bin width = sr/size ~= 23.4 Hz)
        expect(hz).toBeGreaterThan(940);
        expect(hz).toBeLessThan(1060);
    });

    it('orders low and high tones correctly', () => {
        const low = sine(8192, 200, sr);
        const high = sine(8192, 4000, sr);
        expect(analyzer.centroidHz(low, low, 2048, sr)).toBeLessThan(analyzer.centroidHz(high, high, 2048, sr));
    });

    it('maps to 0..1 monotonically with pitch', () => {
        const freqs = [150, 400, 1000, 3000, 6000];
        const vals = freqs.map((f) => {
            const s = sine(8192, f, sr);
            return analyzer.centroid01(s, s, 2048, sr);
        });
        for (let i = 1; i < vals.length; i++) expect(vals[i]!).toBeGreaterThan(vals[i - 1]!);
        for (const v of vals) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });

    it('returns mid hue for silence', () => {
        const quiet = new Float32Array(8192);
        expect(analyzer.centroidHz(quiet, quiet, 2048, sr)).toBe(0);
        expect(analyzer.centroid01(quiet, quiet, 2048, sr)).toBeCloseTo(0.5, 5);
    });

    it('uses the L+R mix (a tone in either channel registers)', () => {
        const tone = sine(8192, 1500, sr);
        const zero = new Float32Array(8192);
        const leftOnly = analyzer.centroidHz(tone, zero, 2048, sr);
        const rightOnly = analyzer.centroidHz(zero, tone, 2048, sr);
        expect(leftOnly).toBeGreaterThan(1400);
        expect(leftOnly).toBeLessThan(1600);
        expect(rightOnly).toBeCloseTo(leftOnly, 5);
    });
});
