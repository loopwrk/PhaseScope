import { describe, it, expect, vi } from 'vitest';
import { toRunResult, type SketchModule, type SketchParams } from '~/utils/sketch/runner';

/* A params source the test can move under the module's feet - that is
   how the live/snapshot split is observed. */
function mutableParams(initial: SketchParams) {
    const current = { ...initial };
    return { read: () => ({ ...current }), set: (patch: SketchParams) => Object.assign(current, patch) };
}

const ctx = {} as CanvasRenderingContext2D;

describe('toRunResult - params contract', () => {
    it('gives audio() a snapshot taken when it runs', () => {
        const params = mutableParams({ f: 220 });
        const audio = vi.fn(() => new Float32Array(8));
        toRunResult({ audio } as SketchModule, 48000, params.read, performance.now());

        params.set({ f: 440 });
        expect(audio).toHaveBeenCalledTimes(1);
        expect(audio.mock.calls[0]![0]).toEqual({ sampleRate: 48000, params: { f: 220 } });
    });

    it('gives render() a fresh read on every frame', () => {
        const params = mutableParams({ A: 0.15 });
        const render = vi.fn();
        const result = toRunResult({ render } as SketchModule, 48000, params.read, performance.now());

        result.renderFrame!(ctx, 0);
        params.set({ A: 0.45 });
        result.renderFrame!(ctx, 1);

        expect(render.mock.calls.map((call) => call[2].params.A)).toEqual([0.15, 0.45]);
    });

    it('passes the frame time through untouched', () => {
        const render = vi.fn();
        const result = toRunResult({ render } as SketchModule, 48000, () => ({}), performance.now());
        result.renderFrame!(ctx, 1.25);
        expect(render.mock.calls[0]![1]).toBe(1.25);
    });
});

describe('toRunResult - shape', () => {
    it('fails when the module exports neither entry point', () => {
        const result = toRunResult({} as SketchModule, 48000, () => ({}), performance.now());
        expect(result.ok).toBe(false);
        expect(result.message).toContain('nothing to run');
        expect(result.renderFrame).toBeUndefined();
    });

    it('wraps a mono return as one channel and reports the sample count', () => {
        const result = toRunResult(
            { audio: () => new Float32Array(96000) } as SketchModule,
            48000,
            () => ({}),
            performance.now()
        );
        expect(result.ok).toBe(true);
        expect(result.channels).toHaveLength(1);
        expect(result.message).toContain('96000 samples');
        /* no render export - nothing for the canvas to loop on */
        expect(result.renderFrame).toBeUndefined();
    });

    it('keeps a stereo pair as two channels', () => {
        const result = toRunResult(
            { audio: () => [new Float32Array(4), new Float32Array(4)] } as SketchModule,
            48000,
            () => ({}),
            performance.now()
        );
        expect(result.channels).toHaveLength(2);
    });

    it('rejects an empty or non-Float32Array return', () => {
        for (const audio of [() => new Float32Array(0), () => [] as Float32Array[], () => [1, 2] as never]) {
            const result = toRunResult({ audio } as SketchModule, 48000, () => ({}), performance.now());
            expect(result.ok).toBe(false);
            expect(result.message).toContain('non-empty Float32Array');
        }
    });

    it('reports rendering when the module draws', () => {
        const result = toRunResult({ render: () => {} } as SketchModule, 48000, () => ({}), performance.now());
        expect(result.message).toContain('rendering');
        expect(result.renderFrame).toBeTypeOf('function');
    });
});
