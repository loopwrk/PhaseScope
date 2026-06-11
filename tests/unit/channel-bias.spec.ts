import { describe, it, expect } from 'vitest';
import { channelBiasTransform, CHANNEL_BIAS_Z_KEEP } from '~/utils/channelBias';

/* Channel bias (the Display Settings toggle): the stereo field pulled
   apart into left/right populations. Sole survivor of the retired
   narrative-stage experiment - these invariants are what earned it
   promotion. */

const params = (L: number, R: number) => ({ L, R, normalizedAmp: 0.5, frameIndex: 10, uAngle: 0 });

describe('channelBiasTransform', () => {
    it('splits by channel dominance: L-heavy pulls one way, R-heavy the other', () => {
        const left = channelBiasTransform({ x: 0, y: 0, z: 0 }, params(0.8, 0.1), 1);
        const right = channelBiasTransform({ x: 0, y: 0, z: 0 }, params(0.1, 0.8), 1);
        expect(left.x).toBeGreaterThan(0.5);
        expect(right.x).toBeLessThan(-0.5);
    });

    it('keeps the structure readable (no total y/z crush)', () => {
        const out = channelBiasTransform({ x: 0, y: 2, z: 2 }, params(0.5, -0.5), 1);
        expect(Math.abs(out.y)).toBeGreaterThan(1); // 55% of y survives
        expect(Math.abs(out.z)).toBeGreaterThan(0.7); // 40% of z survives
    });

    it('z survives by exactly CHANNEL_BIAS_Z_KEEP (the camera tracks with it)', () => {
        const out = channelBiasTransform({ x: 0, y: 0, z: 10 }, params(0.5, -0.5), 1);
        expect(out.z).toBeCloseTo(10 * CHANNEL_BIAS_Z_KEEP, 10);
    });

    it('is the identity at zero strength (jitter aside)', () => {
        const out = channelBiasTransform({ x: 1, y: 2, z: 3 }, params(0.5, -0.5), 0);
        expect(out.x).toBeCloseTo(1, 10);
        expect(out.y).toBeCloseTo(2, 1); // jitter is +-0.0075
        expect(out.z).toBeCloseTo(3, 10);
    });

    it('is deterministic for identical inputs', () => {
        const a = channelBiasTransform({ x: 1, y: 1, z: 1 }, params(0.3, -0.2), 1);
        const b = channelBiasTransform({ x: 1, y: 1, z: 1 }, params(0.3, -0.2), 1);
        expect(a).toEqual(b);
    });
});
