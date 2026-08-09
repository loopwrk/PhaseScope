/* Sketch runner - turns the code tab into a live module and normalises
   what it exports into the shape the workspace consumes:

     { renderFrame?, channels?, message | error }

   JS is the only executing language for now; the adapter table is the
   extension point the spec asks for (TEX renders, C# would compile). A
   sketch module may export:
     render(ctx, t)            - draws a frame into the canvas 2d context
     audio({ sampleRate })     - returns Float32Array (mono) or [L, R]
   Either is optional; exporting neither is an error worth surfacing. */

import type { SketchLanguage } from './model';

export type RenderFrame = (ctx: CanvasRenderingContext2D, t: number) => void;

export interface RunResult {
    ok: boolean;
    message: string;
    durationMs: number;
    renderFrame?: RenderFrame;
    /* Mono or stereo sample data at the requested rate. */
    channels?: Float32Array[];
}

interface SketchModule {
    render?: RenderFrame;
    audio?: (opts: { sampleRate: number }) => Float32Array | Float32Array[];
}

function fail(message: string, startedAt: number): RunResult {
    return { ok: false, message, durationMs: performance.now() - startedAt };
}

async function runJs(code: string, sampleRate: number): Promise<RunResult> {
    const startedAt = performance.now();
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    try {
        const module = (await import(/* @vite-ignore */ url)) as SketchModule;
        if (typeof module.render !== 'function' && typeof module.audio !== 'function') {
            return fail('nothing to run - export render(ctx, t) or audio({ sampleRate })', startedAt);
        }

        let channels: Float32Array[] | undefined;
        if (typeof module.audio === 'function') {
            const returned = module.audio({ sampleRate });
            channels = Array.isArray(returned) ? returned : [returned];
            if (!channels.length || channels.some((c) => !(c instanceof Float32Array) || c.length === 0)) {
                return fail('audio() must return a non-empty Float32Array or [left, right]', startedAt);
            }
        }

        const durationMs = performance.now() - startedAt;
        const parts = [`ran in ${Math.max(1, Math.round(durationMs))}ms`];
        if (channels) parts.push(`${channels[0]!.length} samples`);
        if (module.render) parts.push('rendering');
        return {
            ok: true,
            message: parts.join(' · '),
            durationMs,
            renderFrame: typeof module.render === 'function' ? module.render : undefined,
            channels,
        };
    } catch (error) {
        return fail(error instanceof Error ? error.message : String(error), startedAt);
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function runSketch(language: SketchLanguage, code: string, sampleRate: number): Promise<RunResult> {
    if (language === 'js') return runJs(code, sampleRate);
    /* tex: nothing executes - the maths tab renders (KaTeX, later chunk). */
    return { ok: true, message: 'nothing to run for tex sketches', durationMs: 0 };
}
