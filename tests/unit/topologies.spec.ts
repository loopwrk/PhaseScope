// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { TOPOLOGIES, type CorridorState } from '~/utils/topologies';

/* Geometric invariants of the per-topology frame mappers. The mappers are
   pure (frameIndex, state, meta) -> mapPoint closures, so they can be
   exercised directly - including at the hypothetical "full lap" frame the
   runtime never reaches, which is where the Mobius seam identity lives. */

const FRAME_COUNT = 128;

const state = (over: Partial<CorridorState> = {}): CorridorState => ({
    buffer: null,
    live: false,
    sr: 44100,
    ch0: null,
    ch1: null,
    frameCount: FRAME_COUNT,
    xyScale: 1.8,
    ringRadius: 1.8,
    builtFrames: 0,
    pos: null,
    spine: null,
    spineNormals: null,
    spineBinormals: null,
    framePitch: null,
    ...over,
});

const meta = { zStep: 0.08, pointsPerFrame: 512, windowSize: 2048, hopSize: 1024 };

describe('corridor mapper', () => {
    it('spaces frames along Z by zStep, centred on the track midpoint', () => {
        // At u = 0 with silent input, mapPoint's z is the frame's backbone z
        const first = TOPOLOGIES.corridor.frameMapper(0, state(), meta)!;
        const mid = TOPOLOGIES.corridor.frameMapper(FRAME_COUNT / 2, state(), meta)!;
        expect(mid.mapPoint(0, 0, 0, 0).z).toBeCloseTo(0, 6);
        expect(first.mapPoint(0, 0, 0, 0).z).toBeCloseTo((-FRAME_COUNT / 2) * meta.zStep, 6);
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

describe('helix mapper', () => {
    it('puts each base pair on the backbone radius, with the head anchor on the axis at the same height', () => {
        const f0 = TOPOLOGIES.helix.frameMapper(0, state(), meta)!;
        const start = f0.mapPoint(0, 0, 0, 0); // t = 0 -> strand 1 start
        expect(Math.hypot(start.x, start.y)).toBeGreaterThan(1); // out on the backbone, not the axis
        // The head climbs the axis; its height matches the strand-1 start of the frame.
        const anchor = TOPOLOGIES.helix.headAnchor!(0, state(), meta);
        expect(anchor.x).toBeCloseTo(0, 6);
        expect(anchor.y).toBeCloseTo(0, 6);
        expect(anchor.z).toBeCloseTo(start.z, 6);
    });

    it('winds by a constant pitch: successive base pairs advance steadily in Z at a fixed radius', () => {
        // framePitch null -> no twist wobble, so the closed-form arcs are uniform
        const a = TOPOLOGIES.helix.frameMapper(5, state(), meta)!.mapPoint(0, 0, 0, 0);
        const b = TOPOLOGIES.helix.frameMapper(6, state(), meta)!.mapPoint(0, 0, 0, 0);
        const c = TOPOLOGIES.helix.frameMapper(7, state(), meta)!.mapPoint(0, 0, 0, 0);
        expect(b.z - a.z).toBeCloseTo(c.z - b.z, 6); // constant rise
        expect(Math.hypot(b.x, b.y)).toBeCloseTo(Math.hypot(a.x, a.y), 6); // constant radius
    });

    it('draws the rung between the strands at the step mid-height when silent', () => {
        const f = TOPOLOGIES.helix.frameMapper(10, state(), meta)!;
        const next = TOPOLOGIES.helix.frameMapper(11, state(), meta)!;
        const z0 = f.mapPoint(0, 0, 0, 0).z; // strand-1 start height
        const rise = next.mapPoint(0, 0, 0, 0).z - z0;
        const rung = f.mapPoint(Math.PI, 0, 0, 0); // t = 0.5 -> middle of the rung
        expect(rung.z).toBeCloseTo(z0 + 0.5 * rise, 6);
        // a chord between two backbone points sits inside the backbone radius
        const radius = Math.hypot(f.mapPoint(0, 0, 0, 0).x, f.mapPoint(0, 0, 0, 0).y);
        expect(Math.hypot(rung.x, rung.y)).toBeLessThan(radius + 1e-6);
    });

    it('produces finite points across the whole ring for extreme samples', () => {
        const f = TOPOLOGIES.helix.frameMapper(20, state(), meta)!;
        for (const u of [0, 1.5, Math.PI, 4.5, 6.0]) {
            for (const [L, R] of [
                [1, -1],
                [-1, 1],
                [0, 0],
            ] as const) {
                const p = f.mapPoint(u, L, R, 1);
                expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
            }
        }
    });

    it('sequences the colour from the stereo quadrant (different fields, different bases)', () => {
        const n = meta.windowSize + meta.hopSize * 2;
        const fill = (l: number, r: number) => {
            const ch0 = new Float32Array(n);
            const ch1 = new Float32Array(n);
            ch0.fill(l);
            ch1.fill(r);
            return { ch0, ch1 };
        };
        // left-dominant, in-phase -> S1 > 0, S2 > 0 (one base)
        const a = fill(0.8, 0.2);
        const hueA = TOPOLOGIES.helix.frameHue!(0, state({ ch0: a.ch0, ch1: a.ch1 }), meta);
        // right-dominant, anti-phase -> S1 < 0, S2 < 0 (a different base)
        const b = fill(0.2, -0.8);
        const hueB = TOPOLOGIES.helix.frameHue!(0, state({ ch0: b.ch0, ch1: b.ch1 }), meta);
        expect(hueA).not.toBeNull();
        expect(hueB).not.toBeNull();
        expect(hueA).not.toBe(hueB);
    });

    it('has no colour to give without channels (falls back to the centroid hue)', () => {
        expect(TOPOLOGIES.helix.frameHue!(0, state(), meta)).toBeNull();
    });
});
