// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { TOPOLOGIES, type CorridorState } from '~/utils/topologies';
import { precomputeTorusKnotSpine } from '~/utils/torusKnot';

/* The two pitch-shaped topologies:
     - spherical harmonics: a sphere whose lobe count rises with pitch
     - torus knot: a curve that lies exactly on its torus, wound by brightness */

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

describe('spherical harmonics mapper', () => {
    // Count how many times the equator ring's radius crosses the base sphere -
    // 2 per lobe, so it tracks the harmonic mode order l.
    const lobeCrossings = (pitch01: number) => {
        const frameCount = 100;
        const framePitch = new Float32Array(frameCount).fill(pitch01);
        const raw = baseState({ frameCount, framePitch });
        const frame = TOPOLOGIES.harmonics.frameMapper(frameCount / 2, raw, META)!; // equator frame
        const base = 4.5;
        let prev = 0;
        let crossings = 0;
        const M = 600;
        for (let k = 0; k < M; k++) {
            const u = (k / M) * 2 * Math.PI;
            const p = frame.mapPoint(u, 0, 0, 0);
            const r = Math.hypot(p.x, p.y, p.z); // distance from origin = the modulated radius
            const sign = Math.sign(r - base);
            if (sign !== 0 && prev !== 0 && sign !== prev) crossings++;
            if (sign !== 0) prev = sign;
        }
        return crossings;
    };

    it('grows more lobes as pitch rises', () => {
        expect(lobeCrossings(0.9)).toBeGreaterThan(lobeCrossings(0.1));
    });

    it('stays finite and bounded around the base radius', () => {
        const framePitch = new Float32Array(100).fill(0.7);
        for (const f of [0, 25, 50, 99]) {
            const frame = TOPOLOGIES.harmonics.frameMapper(f, baseState({ frameCount: 100, framePitch }), META)!;
            for (const u of [0, 1.3, 3.0, 5.5]) {
                const p = frame.mapPoint(u, 0.5, -0.5, 1);
                const r = Math.hypot(p.x, p.y, p.z);
                expect(Number.isFinite(r)).toBe(true);
                expect(r).toBeLessThan(4.5 + 1.7 + 1 + 0.01); // base + lobeDepth + amp
            }
        }
    });
});

describe('torus knot spine', () => {
    const N = 600;
    const SR = 44100;
    const HOP = 1024;
    const WIN = 2048;
    const tone = (hz: number) => {
        const len = N * HOP + WIN;
        const ch = new Float32Array(len);
        for (let i = 0; i < len; i++) ch[i] = Math.sin((2 * Math.PI * hz * i) / SR);
        return ch;
    };

    it('lays the spine exactly on its torus (major 4, minor 1.4)', () => {
        const ch = tone(440);
        const { spine, normals, binormals } = precomputeTorusKnotSpine(N, ch, ch, HOP, WIN, SR);
        expect(spine.length).toBe(N * 3);
        expect(normals.length).toBe(N * 3);
        expect(binormals.length).toBe(N * 3);
        for (let f = 0; f < N; f++) {
            const x = spine[f * 3]!;
            const y = spine[f * 3 + 1]!;
            const z = spine[f * 3 + 2]!;
            const ringDist = Math.hypot(x, z) - 4; // distance from the major circle, in-plane
            expect(Math.hypot(ringDist, y)).toBeCloseTo(1.4, 4); // == the minor radius
            expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
        }
    });

    it('brightness selects the knot: very different material gives a different curve', () => {
        const dark = precomputeTorusKnotSpine(N, tone(120), tone(120), HOP, WIN, SR).spine;
        const bright = precomputeTorusKnotSpine(N, tone(7000), tone(7000), HOP, WIN, SR).spine;
        let maxDiff = 0;
        for (let i = 0; i < N * 3; i++) maxDiff = Math.max(maxDiff, Math.abs((dark[i] ?? 0) - (bright[i] ?? 0)));
        expect(maxDiff).toBeGreaterThan(0.5);
    });
});
