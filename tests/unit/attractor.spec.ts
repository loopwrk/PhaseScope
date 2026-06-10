import { describe, it, expect } from 'vitest';
import { precomputeAttractorSpine } from '~/utils/attractor';

/* The Lorenz spine is the deepest math in the engine: RK4 integration with
   an audio-modulated rho, then Frenet frames via parallel transport. The
   invariants below are what the attractor topology silently relies on -
   if any of them drift, the tube cross-sections shear or collapse. */

const FRAMES = 200;
const HOP = 1024;

const silence = () => new Float32Array(FRAMES * HOP);
const loud = () => {
    const s = new Float32Array(FRAMES * HOP);
    for (let i = 0; i < s.length; i++) s[i] = Math.sin(i * 0.05) * 0.9;
    return s;
};

const extent = (arr: Float32Array, axis: number) => {
    let min = Infinity;
    let max = -Infinity;
    for (let f = 0; f < FRAMES; f++) {
        const v = arr[f * 3 + axis]!;
        if (v < min) min = v;
        if (v > max) max = v;
    }
    return { min, max };
};

describe('precomputeAttractorSpine', () => {
    const { spine, normals, binormals } = precomputeAttractorSpine(FRAMES, loud(), HOP);

    it('returns one 3-vector per frame for spine, normals and binormals', () => {
        expect(spine.length).toBe(FRAMES * 3);
        expect(normals.length).toBe(FRAMES * 3);
        expect(binormals.length).toBe(FRAMES * 3);
    });

    it('never produces NaN or infinity (the lesson of the silenced composition)', () => {
        for (const arr of [spine, normals, binormals]) {
            for (let i = 0; i < arr.length; i++) {
                expect(Number.isFinite(arr[i])).toBe(true);
            }
        }
    });

    it('centres the trajectory on the origin and scales it to diameter 12', () => {
        let maxExtent = 0;
        for (const axis of [0, 1, 2]) {
            const { min, max } = extent(spine, axis);
            expect((min + max) / 2).toBeCloseTo(0, 4);
            maxExtent = Math.max(maxExtent, max - min);
        }
        expect(maxExtent).toBeCloseTo(12, 4);
    });

    it('keeps Frenet frames unit-length and mutually orthogonal', () => {
        for (let f = 0; f < FRAMES; f++) {
            const n = [normals[f * 3]!, normals[f * 3 + 1]!, normals[f * 3 + 2]!];
            const b = [binormals[f * 3]!, binormals[f * 3 + 1]!, binormals[f * 3 + 2]!];
            const nLen = Math.hypot(...n);
            const bLen = Math.hypot(...b);
            const dot = n[0]! * b[0]! + n[1]! * b[1]! + n[2]! * b[2]!;
            expect(nLen).toBeCloseTo(1, 2);
            expect(bLen).toBeCloseTo(1, 2);
            expect(Math.abs(dot)).toBeLessThan(0.02);
        }
    });

    it('keeps normals perpendicular to the spine tangent (parallel transport)', () => {
        for (let f = 1; f < FRAMES; f++) {
            const tx = spine[f * 3]! - spine[(f - 1) * 3]!;
            const ty = spine[f * 3 + 1]! - spine[(f - 1) * 3 + 1]!;
            const tz = spine[f * 3 + 2]! - spine[(f - 1) * 3 + 2]!;
            const tLen = Math.hypot(tx, ty, tz);
            if (tLen < 1e-9) continue; // stationary step - tangent undefined
            const dot =
                (tx / tLen) * normals[f * 3]! + (ty / tLen) * normals[f * 3 + 1]! + (tz / tLen) * normals[f * 3 + 2]!;
            expect(Math.abs(dot)).toBeLessThan(0.05);
        }
    });

    it('is deterministic: identical inputs produce identical trajectories', () => {
        const a = precomputeAttractorSpine(FRAMES, loud(), HOP);
        const b = precomputeAttractorSpine(FRAMES, loud(), HOP);
        expect(a.spine).toEqual(b.spine);
        expect(a.normals).toEqual(b.normals);
        expect(a.binormals).toEqual(b.binormals);
    });

    it('lets the audio envelope steer the trajectory (rho modulation)', () => {
        const quiet = precomputeAttractorSpine(FRAMES, silence(), HOP);
        let maxDiff = 0;
        for (let i = 0; i < spine.length; i++) {
            maxDiff = Math.max(maxDiff, Math.abs(spine[i]! - quiet.spine[i]!));
        }
        expect(maxDiff).toBeGreaterThan(0.1); // loud audio bends the butterfly
    });

    it('survives degenerate input (silence) without NaN', () => {
        const quiet = precomputeAttractorSpine(FRAMES, silence(), HOP);
        for (let i = 0; i < quiet.spine.length; i++) {
            expect(Number.isFinite(quiet.spine[i])).toBe(true);
            expect(Number.isFinite(quiet.normals[i])).toBe(true);
            expect(Number.isFinite(quiet.binormals[i])).toBe(true);
        }
    });
});
