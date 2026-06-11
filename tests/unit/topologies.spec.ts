// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { TOPOLOGIES, type CorridorState } from '~/composables/usePhaseGeometry.client';

/* Geometric invariants of the per-topology frame mappers. The mappers are
   pure (frameIndex, state, meta) -> mapPoint closures, so they can be
   exercised directly - including at the hypothetical "full lap" frame the
   runtime never reaches, which is where the Mobius seam identity lives. */

const FRAME_COUNT = 128;

const state = (over: Partial<CorridorState> = {}): CorridorState => ({
    buffer: null,
    sr: 44100,
    ch0: null,
    ch1: null,
    frameCount: FRAME_COUNT,
    xyScale: 1.8,
    ringRadius: 1.8,
    builtFrames: 0,
    pos: null,
    frequencies: null,
    amplitudes: null,
    anchorPositions: null,
    attractorSpine: null,
    attractorNormals: null,
    attractorBinormals: null,
    ...over,
});

const meta = { zStep: 0.08, pointsPerFrame: 512, windowSize: 2048, hopSize: 1024 };

describe('corridor mapper', () => {
    it('spaces frames along Z by zStep, centred on the track midpoint', () => {
        const first = TOPOLOGIES.corridor.frameMapper(0, state(), meta)!;
        const mid = TOPOLOGIES.corridor.frameMapper(FRAME_COUNT / 2, state(), meta)!;
        expect(mid.z0).toBeCloseTo(0, 6);
        expect(first.z0).toBeCloseTo((-FRAME_COUNT / 2) * meta.zStep, 6);
    });
});

describe('sphere mapper', () => {
    it('starts every point of frame 0 at the north pole', () => {
        const frame = TOPOLOGIES.sphere.frameMapper(0, state(), meta)!;
        for (const u of [0, 1, 2, 5]) {
            const p = frame.mapPoint(u, 0, 0, 0);
            expect(p.x).toBeCloseTo(0, 6);
            expect(p.z).toBeCloseTo(0, 6);
            expect(p.y).toBeCloseTo(5.0, 6); // base radius, zero displacement
        }
    });
});

describe('attractor mapper', () => {
    it('refuses to map without a precomputed spine', () => {
        expect(TOPOLOGIES.attractor.frameMapper(0, state(), meta)).toBeNull();
    });
});

describe('mobius mapper', () => {
    const BAND_RADIUS = 6.0;
    const RING_RADIUS = 0.35;

    it('keeps silence exactly on the skeleton ring around the centreline', () => {
        const frame = TOPOLOGIES.mobius.frameMapper(0, state(), meta)!;
        for (const u of [0, 0.7, Math.PI, 4.4]) {
            const p = frame.mapPoint(u, 0, 0, 0);
            // distance from the band centreline at theta = 0, which sits at
            // (BAND_RADIUS, 0, 0)
            const d = Math.hypot(p.x - BAND_RADIUS, p.y, p.z);
            expect(d).toBeCloseTo(RING_RADIUS, 6);
        }
    });

    it('returns the full lap as the mirror of the start (the half-twist seam)', () => {
        // The runtime never maps frame === frameCount, but the seam identity
        // must hold there: after one lap (theta = 2pi, twist = pi) the same
        // sample lands point-reflected through the centreline - the portrait
        // of the inverted signal. You can return to the place, but not to
        // the self that left it.
        const start = TOPOLOGIES.mobius.frameMapper(0, state(), meta)!;
        const seam = TOPOLOGIES.mobius.frameMapper(FRAME_COUNT, state(), meta)!;
        for (const [u, L, R] of [
            [0, 0.5, 0.25],
            [2.1, -0.3, 0.7],
            [4.0, 0.9, -0.9],
        ] as const) {
            const p0 = start.mapPoint(u, L, R, 0.5);
            const p1 = seam.mapPoint(u, L, R, 0.5);
            // Both frames sit at the same centreline point (BAND_RADIUS, 0, 0);
            // the cross-section offset arrives negated in both axes.
            expect(p1.x - BAND_RADIUS).toBeCloseTo(-(p0.x - BAND_RADIUS), 6);
            expect(p1.y).toBeCloseTo(-p0.y, 6);
            expect(p1.z).toBeCloseTo(-p0.z, 6);
        }
    });

    it('rotates the cross-section by a quarter turn at the half lap', () => {
        // At theta = pi the twist is pi/2: what was radial at the start is
        // vertical here. A purely "horizontal" sample (L only) maps to a
        // purely vertical offset.
        const half = TOPOLOGIES.mobius.frameMapper(FRAME_COUNT / 2, state(), meta)!;
        const p = half.mapPoint(0, 0.5, 0, 0.5);
        const a = 0.5 * 1.8 + RING_RADIUS; // portrait X + ring at u = 0
        // centreline at theta = pi is (-BAND_RADIUS, 0, 0); offset is all vertical
        expect(p.x).toBeCloseTo(-BAND_RADIUS, 6);
        expect(p.z).toBeCloseTo(0, 5);
        expect(p.y).toBeCloseTo(a, 6);
    });

    it('produces finite points for extreme samples at every phase of the lap', () => {
        for (const f of [0, 17, FRAME_COUNT / 2, FRAME_COUNT - 1]) {
            const frame = TOPOLOGIES.mobius.frameMapper(f, state(), meta)!;
            for (const [L, R] of [
                [1, -1],
                [-1, 1],
                [0, 0],
            ] as const) {
                const p = frame.mapPoint(3.3, L, R, 1);
                expect(Number.isFinite(p.x)).toBe(true);
                expect(Number.isFinite(p.y)).toBe(true);
                expect(Number.isFinite(p.z)).toBe(true);
            }
        }
    });
});
