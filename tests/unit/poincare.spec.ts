import { describe, it, expect } from 'vitest';
import { stokesVector } from '~/utils/poincare';

/* The Poincaré sphere maps the stereo field's polarization to the Stokes vector.
   These checks pin the physics: quadrature L/R lands on the poles (circular
   polarization), in-phase mono on the equator, anti-phase on its antipode, a
   hard-panned signal on the balance axis. Decorrelated audio sinks toward the
   centre; silence IS the centre; and the state never leaves the unit ball. */

const N = 4096;
const W = 0.1; // rad/sample - well below Nyquist, so the difference estimators are accurate

const mag = (s: { s1: number; s2: number; s3: number }) => Math.hypot(s.s1, s.s2, s.s3);

const make = (fL: (i: number) => number, fR: (i: number) => number) => {
    const L = new Float32Array(N);
    const R = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        L[i] = fL(i);
        R[i] = fR(i);
    }
    return { L, R };
};

describe('stokesVector (Poincaré sphere)', () => {
    it('quadrature (R 90deg behind L) lands on a pole: s3 ~ +1', () => {
        const { L, R } = make(
            (i) => Math.cos(W * i),
            (i) => Math.sin(W * i)
        );
        const s = stokesVector(L, R, 0, N);
        expect(s.s3).toBeGreaterThan(0.95);
        expect(Math.abs(s.s1)).toBeLessThan(0.1);
        expect(Math.abs(s.s2)).toBeLessThan(0.1);
    });

    it('opposite quadrature lands on the other pole: s3 ~ -1', () => {
        const { L, R } = make(
            (i) => Math.cos(W * i),
            (i) => -Math.sin(W * i)
        );
        expect(stokesVector(L, R, 0, N).s3).toBeLessThan(-0.95);
    });

    it('in-phase mono (L = R) sits on the equator at +s2', () => {
        const { L, R } = make(
            (i) => Math.cos(W * i),
            (i) => Math.cos(W * i)
        );
        const s = stokesVector(L, R, 0, N);
        expect(s.s2).toBeGreaterThan(0.95);
        expect(Math.abs(s.s1)).toBeLessThan(0.05);
        expect(Math.abs(s.s3)).toBeLessThan(0.05);
    });

    it('anti-phase (R = -L) is the antipode: s2 ~ -1', () => {
        const { L, R } = make(
            (i) => Math.cos(W * i),
            (i) => -Math.cos(W * i)
        );
        expect(stokesVector(L, R, 0, N).s2).toBeLessThan(-0.95);
    });

    it('hard-left (R = 0) sits on the balance axis: s1 ~ +1', () => {
        const { L, R } = make(
            (i) => Math.cos(W * i),
            () => 0
        );
        expect(stokesVector(L, R, 0, N).s1).toBeGreaterThan(0.95);
    });

    it('the result is amplitude-invariant (a louder copy maps to the same state)', () => {
        const quiet = make(
            (i) => 0.2 * Math.cos(W * i),
            (i) => 0.2 * Math.sin(W * i)
        );
        const loud = make(
            (i) => 1.5 * Math.cos(W * i),
            (i) => 1.5 * Math.sin(W * i)
        );
        const a = stokesVector(quiet.L, quiet.R, 0, N);
        const b = stokesVector(loud.L, loud.R, 0, N);
        expect(a.s3).toBeCloseTo(b.s3, 6);
        expect(a.s1).toBeCloseTo(b.s1, 6);
    });

    it('silence is the centre of the ball', () => {
        const { L, R } = make(
            () => 0,
            () => 0
        );
        expect(stokesVector(L, R, 0, N)).toEqual({ s1: 0, s2: 0, s3: 0 });
    });

    it('decorrelated channels sink toward the centre (low polarization)', () => {
        const { L, R } = make(
            (i) => Math.cos(0.1 * i),
            (i) => Math.cos(0.137 * i + 1.0)
        );
        expect(mag(stokesVector(L, R, 0, N))).toBeLessThan(0.5);
    });

    it('never leaves the unit ball', () => {
        const cases = [
            make(
                (i) => Math.cos(W * i),
                (i) => Math.sin(W * i)
            ),
            make(
                (i) => Math.cos(0.3 * i),
                (i) => Math.sin(0.25 * i)
            ),
            make(
                (i) => 2 * Math.cos(W * i),
                (i) => 0.5 * Math.sin(W * i + 0.7)
            ),
        ];
        for (const { L, R } of cases) {
            expect(mag(stokesVector(L, R, 0, N))).toBeLessThanOrEqual(1 + 1e-9);
        }
    });
});
