import { describe, it, expect } from 'vitest';
import { oscillationOffset, PHASE_SHIFT_Y, WAVE_LENGTH, type OscillationInputs } from '~/utils/oscillation';

/* utils/oscillation.ts is the REFERENCE implementation of the GPU
   displacement (the GLSL in useCorridorRenderer mirrors it line for line).
   These invariants are the renderer's contract: displacement never exceeds
   the stored amplitude, per-frame mode is rigid per frame, and the wave's
   spatial phase ripples backward from the corridor head. */

const base: OscillationInputs = {
    mode: 'per-point',
    time: 0.37,
    pointFreq: 220,
    pointAmp: 0.04,
    frameAvgFreq: 440,
    frameAvgAmp: 0.02,
    frameIndex: 10,
    builtFrames: 100,
};

const magnitudeBound = (o: { dx: number; dy: number; dz: number }, amp: number) => {
    for (const d of [o.dx, o.dy, o.dz]) {
        expect(Math.abs(d)).toBeLessThanOrEqual(amp + 1e-12);
    }
};

describe('oscillationOffset (GPU reference)', () => {
    it.each(['wave', 'per-frame', 'per-point'] as const)('%s never displaces beyond its amplitude', (mode) => {
        for (const time of [0, 0.1, 1.7, 60]) {
            const amp = mode === 'per-point' ? base.pointAmp : base.frameAvgAmp;
            magnitudeBound(oscillationOffset({ ...base, mode, time }), amp);
        }
    });

    it('per-point uses the point data; per-frame and wave use the frame averages', () => {
        const perPoint = oscillationOffset({ ...base, mode: 'per-point' });
        const altered = oscillationOffset({ ...base, mode: 'per-point', frameAvgFreq: 9999, frameAvgAmp: 9 });
        expect(altered).toEqual(perPoint); // frame data is irrelevant per-point

        const perFrame = oscillationOffset({ ...base, mode: 'per-frame' });
        const altered2 = oscillationOffset({ ...base, mode: 'per-frame', pointFreq: 9999, pointAmp: 9 });
        expect(altered2).toEqual(perFrame); // point data is irrelevant per-frame
    });

    it('per-frame is rigid: every point of a frame gets the identical offset', () => {
        const a = oscillationOffset({ ...base, mode: 'per-frame', pointFreq: 1, pointAmp: 0.1 });
        const b = oscillationOffset({ ...base, mode: 'per-frame', pointFreq: 8000, pointAmp: 0.001 });
        expect(a).toEqual(b);
    });

    it('wave phase ripples backward from the head, one cycle per WAVE_LENGTH frames', () => {
        const atHead = oscillationOffset({ ...base, mode: 'wave', frameIndex: base.builtFrames - 1 });
        const oneWavelengthBack = oscillationOffset({
            ...base,
            mode: 'wave',
            frameIndex: base.builtFrames - 1 - WAVE_LENGTH,
        });
        // A full wavelength behind the head, the phase has advanced 2*pi:
        // the displacement is identical
        expect(oneWavelengthBack.dx).toBeCloseTo(atHead.dx, 10);
        expect(oneWavelengthBack.dy).toBeCloseTo(atHead.dy, 10);
        expect(oneWavelengthBack.dz).toBeCloseTo(atHead.dz, 10);
    });

    it('axes are phase-shifted so motion reads as 3D, not a straight line', () => {
        // At phase 0 (t=0, per-point): dx = sin(0) = 0, dy = sin(60deg)*amp
        const o = oscillationOffset({ ...base, mode: 'per-point', time: 0 });
        expect(o.dx).toBeCloseTo(0, 12);
        expect(o.dy).toBeCloseTo(Math.sin(PHASE_SHIFT_Y) * base.pointAmp, 12);
    });

    it('is deterministic', () => {
        expect(oscillationOffset(base)).toEqual(oscillationOffset({ ...base }));
    });
});
