/* Sketch runner - turns the code tab into a live module and normalises
   what it exports into the shape the workspace consumes:

     { renderFrame?, channels?, message | error }

   JS is the only executing language for now; the adapter table is the
   extension point the spec asks for (TEX renders, C# would compile). A
   sketch module may export:
     render(ctx, t, { params })            - draws one frame into a 2d context
     audio({ sampleRate, params })         - Float32Array (mono) or [L, R]
     process(out, { sampleRate, params })  - fills one block, live
   All are optional; exporting none is an error worth surfacing.

   Params reach the exports differently, and the difference is the point.
   render() is handed a *live* read: the canvas loop calls it every frame,
   so a value edited in the equation shows on the next one. process() is
   live too - it runs on the audio thread and reads the current params
   each block, so a value can change mid-note. audio() is the odd one:
   it generates a buffer that is then played back as-is, and nothing can
   reach into it afterwards, so its params are a snapshot taken at RUN and
   the workspace marks the transport stale until the next one.

   A module exporting both process() and audio() is played live; audio()
   is then only what an offline render would use. */

import { clampSeconds, liveSourceProblem, stripModuleExports, type LiveProcess } from './live-source';
import type { SketchLanguage } from './model';

export type RenderFrame = (ctx: CanvasRenderingContext2D, t: number) => void;

export interface RunResult {
    ok: boolean;
    message: string;
    durationMs: number;
    renderFrame?: RenderFrame;
    /* Mono or stereo sample data at the requested rate. */
    channels?: Float32Array[];
    /* Present when the sketch synthesises live instead of returning a buffer. */
    live?: LiveVoice;
}

export type SketchParams = Record<string, number>;
/* Read afresh per frame rather than passed once, so render() sees edits
   without the module being re-imported (which would reset the clock). */
export type ParamsSource = () => SketchParams;

export interface SketchModule {
    render?: (ctx: CanvasRenderingContext2D, t: number, extras?: { params: SketchParams }) => void;
    audio?: (opts: { sampleRate: number; params: SketchParams }) => Float32Array | Float32Array[];
    process?: LiveProcess;
    seconds?: number;
}

/* Everything the audio thread needs to play a sketch live. The code
   travels as a string because functions cannot cross into a worklet. */
export interface LiveVoice {
    code: string;
    seconds: number;
}

function fail(message: string, startedAt: number): RunResult {
    return { ok: false, message, durationMs: performance.now() - startedAt };
}

/* Normalises a loaded module into a RunResult. Split out from the blob
   import so the params contract - audio() snapshots, render() reads live
   - can be tested without a module loader. */
export function toRunResult(
    module: SketchModule,
    sampleRate: number,
    readParams: ParamsSource,
    startedAt: number,
    /* The original source. Only a live sketch needs it - the worklet
       compiles the text itself, since functions cannot cross threads. */
    source = ''
): RunResult {
    const isLive = typeof module.process === 'function';
    if (!isLive && typeof module.render !== 'function' && typeof module.audio !== 'function') {
        return fail('nothing to run - export render(ctx, t), audio({ sampleRate }) or process(out, ctx)', startedAt);
    }

    let live: LiveVoice | undefined;
    if (isLive) {
        /* The worklet compiles the source itself, so anything that only
           works as a module has to be caught here, where the message can
           still reach the output strip. */
        const problem = liveSourceProblem(source);
        if (problem) return fail(problem, startedAt);
        live = { code: stripModuleExports(source), seconds: clampSeconds(module.seconds) };
    }

    let channels: Float32Array[] | undefined;
    if (!isLive && typeof module.audio === 'function') {
        /* Snapshot: the buffer this fills is played as generated. */
        const returned = module.audio({ sampleRate, params: readParams() });
        channels = Array.isArray(returned) ? returned : [returned];
        if (!channels.length || channels.some((c) => !(c instanceof Float32Array) || c.length === 0)) {
            return fail('audio() must return a non-empty Float32Array or [left, right]', startedAt);
        }
    }

    const durationMs = performance.now() - startedAt;
    const parts = [`ran in ${Math.max(1, Math.round(durationMs))}ms`];
    if (live) parts.push(`live · ${live.seconds}s`);
    if (channels) parts.push(`${channels[0]!.length} samples`);
    if (module.render) parts.push('rendering');
    return {
        ok: true,
        message: parts.join(' · '),
        durationMs,
        /* Reads params per frame - live - while keeping the canvas pane's
           plain (ctx, t) contract. */
        renderFrame:
            typeof module.render === 'function'
                ? (ctx, t) => module.render!(ctx, t, { params: readParams() })
                : undefined,
        channels,
        live,
    };
}

async function runJs(code: string, sampleRate: number, readParams: ParamsSource): Promise<RunResult> {
    const startedAt = performance.now();
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    try {
        const module = (await import(/* @vite-ignore */ url)) as SketchModule;
        return toRunResult(module, sampleRate, readParams, startedAt, code);
    } catch (error) {
        return fail(error instanceof Error ? error.message : String(error), startedAt);
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function runSketch(
    language: SketchLanguage,
    code: string,
    sampleRate: number,
    readParams: ParamsSource = () => ({})
): Promise<RunResult> {
    if (language === 'js') return runJs(code, sampleRate, readParams);
    /* tex: nothing executes - the maths tab renders via KaTeX. */
    return { ok: true, message: 'nothing to run for tex sketches', durationMs: 0 };
}
