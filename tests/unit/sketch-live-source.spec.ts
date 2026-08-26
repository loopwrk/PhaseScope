import { describe, it, expect } from 'vitest';
import {
    clampSeconds,
    instantiateLive,
    liveSourceProblem,
    renderLive,
    stripModuleExports,
    DEFAULT_LIVE_SECONDS,
    LIVE_BLOCK_SIZE,
} from '~/utils/sketch/live-source';

const SINE = `
export const seconds = 1;
let phase = 0;
export function process(out, { sampleRate, params }) {
    const { A = 0.4, f = 200 } = params;
    const step = (2 * Math.PI * f) / sampleRate;
    for (let i = 0; i < out.length; i++) {
        phase += step;
        out[i] = A * Math.cos(phase);
    }
}
`;

describe('liveSourceProblem', () => {
    it('passes ordinary named exports', () => {
        expect(liveSourceProblem(SINE)).toBeNull();
    });

    it('turns away module-only syntax with an explanation', () => {
        expect(liveSourceProblem("import x from 'y';")).toContain('import');
        expect(liveSourceProblem('export default function () {}')).toContain('export default');
        expect(liveSourceProblem('export { process };')).toContain('export function');
    });
});

describe('stripModuleExports', () => {
    it('drops the keyword and keeps the declaration', () => {
        expect(stripModuleExports('export function process() {}')).toBe('function process() {}');
        expect(stripModuleExports('export const seconds = 2;')).toBe('const seconds = 2;');
    });

    it('preserves indentation', () => {
        expect(stripModuleExports('    export const a = 1;')).toBe('    const a = 1;');
    });

    it('leaves the word alone when it is not a declaration', () => {
        expect(stripModuleExports('const exported = 1;')).toBe('const exported = 1;');
        expect(stripModuleExports('// exports the wave')).toBe('// exports the wave');
    });
});

describe('clampSeconds', () => {
    it('falls back for anything that is not a usable length', () => {
        for (const bad of [undefined, null, 'two', Number.NaN, 0, -3, Infinity]) {
            expect(clampSeconds(bad)).toBe(DEFAULT_LIVE_SECONDS);
        }
    });

    it('caps a runaway length rather than allocating for it', () => {
        expect(clampSeconds(10_000)).toBe(60);
    });

    it('keeps a sensible one', () => {
        expect(clampSeconds(1.5)).toBe(1.5);
    });
});

describe('instantiateLive', () => {
    it('exposes process and the declared length', () => {
        const mod = instantiateLive(stripModuleExports(SINE));
        expect(mod.process).toBeTypeOf('function');
        expect(mod.seconds).toBe(1);
    });

    it('gives each instance its own module state', () => {
        const code = stripModuleExports(SINE);
        const a = instantiateLive(code);
        const b = instantiateLive(code);
        const outA = new Float32Array(4);
        const outB = new Float32Array(4);

        /* Advance a only - b must still be at the start of its phase. */
        a.process(outA, { sampleRate: 48000, params: { A: 1, f: 1000 } });
        a.process(outA, { sampleRate: 48000, params: { A: 1, f: 1000 } });
        b.process(outB, { sampleRate: 48000, params: { A: 1, f: 1000 } });

        expect(Array.from(outA)).not.toEqual(Array.from(outB));
    });

    it('carries phase across calls rather than restarting each block', () => {
        const mod = instantiateLive(stripModuleExports(SINE));
        const first = new Float32Array(LIVE_BLOCK_SIZE);
        const second = new Float32Array(LIVE_BLOCK_SIZE);
        const ctx = { sampleRate: 48000, params: { A: 1, f: 100 } };
        mod.process(first, ctx);
        mod.process(second, ctx);
        expect(second[0]).not.toBeCloseTo(first[0]!, 6);
    });

    it('rejects module-only syntax', () => {
        expect(() => instantiateLive("import x from 'y';")).toThrow(/import/);
    });

    it('survives a sketch with no process export', () => {
        const mod = instantiateLive('const a = 1;');
        expect(mod.seconds).toBe(DEFAULT_LIVE_SECONDS);
        expect(() => mod.process(new Float32Array(4), { sampleRate: 48000, params: {} })).not.toThrow();
    });
});

describe('renderLive', () => {
    it('produces exactly seconds x sampleRate samples', () => {
        const mod = instantiateLive(stripModuleExports(SINE));
        const out = renderLive(mod, { sampleRate: 8000, params: { A: 1, f: 100 }, seconds: 0.5 });
        expect(out.length).toBe(4000);
    });

    it('renders a wave of the requested amplitude', () => {
        const mod = instantiateLive(stripModuleExports(SINE));
        const out = renderLive(mod, { sampleRate: 8000, params: { A: 0.25, f: 100 }, seconds: 0.5 });
        const peak = Math.max(...Array.from(out).map(Math.abs));
        expect(peak).toBeGreaterThan(0.24);
        expect(peak).toBeLessThanOrEqual(0.25);
    });

    it('completes a whole number of cycles for a matching frequency', () => {
        const mod = instantiateLive(stripModuleExports(SINE));
        const out = renderLive(mod, { sampleRate: 8000, params: { A: 1, f: 100 }, seconds: 1 });
        /* 100 Hz for one second is 100 cycles: 200 zero crossings. */
        let crossings = 0;
        for (let i = 1; i < out.length; i++) {
            if (Math.sign(out[i]!) !== Math.sign(out[i - 1]!)) crossings++;
        }
        expect(crossings).toBe(200);
    });

    it('handles a length that is not a whole number of blocks', () => {
        const mod = instantiateLive(stripModuleExports(SINE));
        const total = 1000; // not a multiple of 128
        const out = renderLive(mod, { sampleRate: total, params: { A: 1, f: 10 }, seconds: 1 });
        expect(out.length).toBe(total);
        expect(out.every((v) => Number.isFinite(v))).toBe(true);
    });
});
