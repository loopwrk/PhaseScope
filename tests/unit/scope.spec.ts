import { describe, it, expect } from 'vitest';
import { stereoCorrelation, pitchChromaHue } from '~/utils/audio/analysis';

/* The scope instruments' shared maths: the goniometer readout and the
   spectrum colour mode both lean on these. */

const sine = (n: number, period: number, amp = 0.5, phase = 0) =>
    Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / period + phase) * amp);

describe('stereoCorrelation', () => {
    const L = sine(2048, 64);

    it('reads identical channels as +1 (mono)', () => {
        expect(stereoCorrelation(L, L, 0, 2048)).toBeCloseTo(1, 6);
    });

    it('reads polarity-inverted channels as -1 (anti-phase)', () => {
        const R = Float32Array.from(L, (v) => -v);
        expect(stereoCorrelation(L, R, 0, 2048)).toBeCloseTo(-1, 6);
    });

    it('reads a quadrature pair as ~0 (decorrelated)', () => {
        const R = sine(2048, 64, 0.5, Math.PI / 2);
        expect(Math.abs(stereoCorrelation(L, R, 0, 2048)!)).toBeLessThan(0.01);
    });

    it('returns null for silence (undefined ratio, not fake mono)', () => {
        expect(stereoCorrelation(new Float32Array(512), new Float32Array(512), 0, 512)).toBeNull();
    });

    it('clamps the window to the buffer safely', () => {
        expect(stereoCorrelation(L, L, 2000, 5000)).toBeCloseTo(1, 6);
    });
});

describe('pitchChromaHue', () => {
    it('gives the same hue to a note in every octave (chroma)', () => {
        const a4 = pitchChromaHue(440);
        expect(pitchChromaHue(880)).toBeCloseTo(a4, 10);
        expect(pitchChromaHue(220)).toBeCloseTo(a4, 10);
        expect(pitchChromaHue(27.5)).toBeCloseTo(a4, 10);
    });

    it('anchors C at hue 0 and walks the wheel within an octave', () => {
        expect(pitchChromaHue(16.3516)).toBeCloseTo(0, 5); // C0 = red
        expect(pitchChromaHue(16.3516 * 2 ** (7 / 12))).toBeCloseTo(7 / 12, 5); // G
    });

    it('wraps continuously: a quarter-tone sits between semitone hues', () => {
        const c = pitchChromaHue(261.63);
        const cSharp = pitchChromaHue(277.18);
        const quarter = pitchChromaHue(261.63 * 2 ** (0.5 / 12));
        expect(quarter).toBeGreaterThan(c);
        expect(quarter).toBeLessThan(cSharp);
    });

    it('is safe for degenerate input', () => {
        expect(pitchChromaHue(0)).toBe(0);
        expect(pitchChromaHue(-5)).toBe(0);
    });
});
