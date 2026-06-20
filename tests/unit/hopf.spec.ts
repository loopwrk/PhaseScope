// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { TOPOLOGIES, type CorridorState } from '~/utils/topologies';
import { precomputeHopfSpine } from '~/utils/hopf';

/* Hopf fibration - each frame's Bloch (Poincaré) point lifted to its fibre, a
   circle, stereographically projected into R^3. precomputeHopfSpine stores the
   smoothed Stokes vector (reusing the Poincaré physics); the mapper traces the
   fibre. These checks pin the lift: the fibre over a pole is a flat circle, the
   fibre over the south pole degenerates onto the projection axis (and the clamp
   keeps it finite), and an equatorial fibre is a genuine 3D (Villarceau) ring. */

const META = { zStep: 0.08, pointsPerFrame: 512, windowSize: 2048, hopSize: 1024 };

const baseState = (over: Partial<CorridorState>): CorridorState => ({
    buffer: null,
    live: false,
    sr: 44100,
    ch0: null,
    ch1: null,
    frameCount: 100,
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

// A one-frame spine holding a single Bloch point (s1, s2, s3)
const spineOf = (s1: number, s2: number, s3: number) => new Float32Array([s1, s2, s3]);

const ringSamples = (frame: { mapPoint: (u: number, L: number, R: number, a: number) => { x: number; y: number; z: number } }) =>
    Array.from({ length: 24 }, (_, k) => frame.mapPoint((k / 24) * 2 * Math.PI, 0, 0, 0));

describe('hopf mapper', () => {
    it('refuses to map without a precomputed spine', () => {
        expect(TOPOLOGIES.hopf.frameMapper(0, baseState({}), META)).toBeNull();
    });

    it('draws the north-pole fibre as a flat circle (constant radius, one plane)', () => {
        // s3 = +1 is the polar Bloch point; its fibre is the unit circle, so the
        // projection is a flat ring of constant radius in the plane y = 0.
        const frame = TOPOLOGIES.hopf.frameMapper(0, baseState({ spine: spineOf(0, 0, 1) }), META)!;
        const pts = ringSamples(frame);
        const radii = pts.map((p) => Math.hypot(p.x, p.z));
        for (const p of pts) expect(p.y).toBeCloseTo(0, 6);
        for (const r of radii) expect(r).toBeCloseTo(radii[0]!, 6);
        expect(radii[0]!).toBeGreaterThan(0.5);
    });

    it('collapses the south-pole fibre onto the projection axis, kept finite by the clamp', () => {
        // s3 = -1 is the antipodal pole; its fibre is the "circle through
        // infinity" - it runs up the Y axis. The denominator clamp keeps it
        // bounded rather than shooting to infinity.
        const frame = TOPOLOGIES.hopf.frameMapper(0, baseState({ spine: spineOf(0, 0, -1) }), META)!;
        for (const p of ringSamples(frame)) {
            expect(p.x).toBeCloseTo(0, 5);
            expect(p.z).toBeCloseTo(0, 5);
            expect(Number.isFinite(p.y)).toBe(true);
        }
    });

    it('lifts an equatorial state into a genuine 3D (Villarceau) ring', () => {
        // In-phase mono sits on the equator; its fibre is a tilted, off-centre
        // circle that occupies all three axes (not a flat ring at the origin).
        const frame = TOPOLOGIES.hopf.frameMapper(0, baseState({ spine: spineOf(0, 1, 0) }), META)!;
        const pts = ringSamples(frame);
        const span = (sel: (p: { x: number; y: number; z: number }) => number) =>
            Math.max(...pts.map(sel)) - Math.min(...pts.map(sel));
        expect(span((p) => p.x)).toBeGreaterThan(0.3);
        expect(span((p) => p.y)).toBeGreaterThan(0.3);
        expect(span((p) => p.z)).toBeGreaterThan(0.3);
        for (const p of pts) expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
    });

    it('a more polarised (coherent) stereo state draws a fuller ring', () => {
        const weak = TOPOLOGIES.hopf.frameMapper(0, baseState({ spine: spineOf(0, 0, 0.2) }), META)!;
        const full = TOPOLOGIES.hopf.frameMapper(0, baseState({ spine: spineOf(0, 0, 1.0) }), META)!;
        const radius = (f: typeof weak) => Math.hypot(ringSamples(f)[0]!.x, ringSamples(f)[0]!.z);
        expect(radius(full)).toBeGreaterThan(radius(weak));
    });
});

describe('hopf spine (reused Stokes physics)', () => {
    const N = 200;
    const SR = 44100;
    const HOP = 1024;
    const WIN = 2048;
    const W = 0.1; // rad/sample
    const build = (fL: (i: number) => number, fR: (i: number) => number) => {
        const len = N * HOP + WIN;
        const ch0 = new Float32Array(len);
        const ch1 = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            ch0[i] = fL(i);
            ch1[i] = fR(i);
        }
        return precomputeHopfSpine(N, ch0, ch1, HOP, WIN);
    };
    const last = (a: Float32Array) => [a[(N - 1) * 3]!, a[(N - 1) * 3 + 1]!, a[(N - 1) * 3 + 2]!] as const;

    it('returns spine plus empty transport frames of the right size', () => {
        const { spine, normals, binormals } = build(
            (i) => Math.cos(W * i),
            (i) => Math.cos(W * i)
        );
        expect(spine.length).toBe(N * 3);
        expect(normals.length).toBe(N * 3);
        expect(binormals.length).toBe(N * 3);
    });

    it('settles in-phase mono onto the equator (s2 ~ +1)', () => {
        const [s1, s2, s3] = last(
            build(
                (i) => Math.cos(W * i),
                (i) => Math.cos(W * i)
            ).spine
        );
        expect(s2).toBeGreaterThan(0.9);
        expect(Math.abs(s1)).toBeLessThan(0.1);
        expect(Math.abs(s3)).toBeLessThan(0.1);
    });

    it('settles quadrature onto a pole (s3 ~ +1)', () => {
        const [, , s3] = last(
            build(
                (i) => Math.cos(W * i),
                (i) => Math.sin(W * i)
            ).spine
        );
        expect(s3).toBeGreaterThan(0.9);
    });
});
