/* Turning a sketch's code into a live voice.

   A live sketch exports `process(out, { sampleRate, params })`, which
   fills one block of samples at a time instead of returning a whole
   buffer. That is what lets a param change land mid-note: the next block
   simply reads the new value.

   The same source is instantiated in two places - the AudioWorklet that
   plays it, and the main thread when a waveform preview is needed - so
   the transform and the instantiation live here rather than in either
   caller. Both go through `new Function`, which gives each instance its
   own module-level state (the phase accumulator, typically). That is the
   point: resetting a voice is just instantiating it again. */

import type { SketchParams } from './runner';

export type LiveProcess = (out: Float32Array, ctx: { sampleRate: number; params: SketchParams }) => void;

export interface LiveModule {
    process: LiveProcess;
    seconds: number;
}

/* Matches the worklet's render quantum, so a preview is generated the
   same way it will be played. */
export const LIVE_BLOCK_SIZE = 128;
export const DEFAULT_LIVE_SECONDS = 2;
/* A runaway `seconds` would allocate the browser out of memory. */
const MAX_LIVE_SECONDS = 60;

/* `new Function` takes a function body, not a module, so anything that
   only makes sense in a module has to be turned away with an
   explanation rather than a SyntaxError from somewhere inside. */
export function liveSourceProblem(code: string): string | null {
    if (/^[ \t]*import[ \t\n]/m.test(code)) {
        return 'live sketches cannot use import - inline what you need';
    }
    if (/^[ \t]*export[ \t]+default\b/m.test(code)) {
        return 'live sketches cannot use export default - export named functions';
    }
    if (/^[ \t]*export[ \t]*\{/m.test(code)) {
        return 'live sketches need `export function name`, not an export list';
    }
    return null;
}

/* Drops the `export` keyword from declarations, leaving the declarations
   themselves in place so they become locals of the function body. */
export function stripModuleExports(code: string): string {
    return code.replace(/^([ \t]*)export[ \t]+/gm, '$1');
}

export function instantiateLive(code: string): LiveModule {
    const problem = liveSourceProblem(code);
    if (problem) throw new Error(problem);

    const factory = new Function(
        `${stripModuleExports(code)}
        return {
            process: typeof process === 'function' ? process : undefined,
            seconds: typeof seconds === 'number' ? seconds : undefined,
        };`
    ) as () => { process?: unknown; seconds?: unknown };

    const built = factory();
    if (typeof built.process !== 'function') {
        return { process: () => {}, seconds: DEFAULT_LIVE_SECONDS };
    }
    return {
        process: built.process as LiveProcess,
        seconds: clampSeconds(built.seconds),
    };
}

export function clampSeconds(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return DEFAULT_LIVE_SECONDS;
    return Math.min(value, MAX_LIVE_SECONDS);
}

/* Runs a voice offline, block by block, exactly as the worklet would.
   Used for the scrub-bar waveform, which can no longer be a by-product of
   generating the audio because the audio is not generated up front. */
export function renderLive(
    module: LiveModule,
    opts: { sampleRate: number; params: SketchParams; seconds?: number }
): Float32Array {
    const seconds = clampSeconds(opts.seconds ?? module.seconds);
    const total = Math.max(1, Math.round(seconds * opts.sampleRate));
    const out = new Float32Array(total);
    const block = new Float32Array(LIVE_BLOCK_SIZE);
    const ctx = { sampleRate: opts.sampleRate, params: opts.params };

    for (let offset = 0; offset < total; offset += LIVE_BLOCK_SIZE) {
        block.fill(0);
        module.process(block, ctx);
        const take = Math.min(LIVE_BLOCK_SIZE, total - offset);
        out.set(take === LIVE_BLOCK_SIZE ? block : block.subarray(0, take), offset);
    }
    return out;
}
