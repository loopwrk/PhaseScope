/* Starter sketches for the empty state. Pure data - the store turns a
   starter into a Sketch via create(starter.seed). Code bodies are
   placeholders until the runner lands; each declares the shape
   the runner will call into so starters stay honest about intent. */

import type { SketchLanguage, SketchSeed } from './model';

export interface SketchStarter {
    /* Library row: language tag + label, e.g. "JS  Blank canvas + audio out". */
    language: SketchLanguage;
    label: string;
    seed: Omit<SketchSeed, 'id' | 'now'>;
}

const BLANK_CANVAS_CODE = `// Blank canvas + audio out.
// render(ctx, t) draws each frame; audio() returns the buffer to play.

export function render(ctx, t) {
    // ctx is a Canvas2D context sized to the canvas well
}

export function audio({ sampleRate }) {
    // return a Float32Array (mono) or [left, right]
    return new Float32Array(sampleRate);
}
`;

const FFT_SCAFFOLD_CODE = `// Windowed FFT scaffold.
// Fill in window + transform; render(ctx, t) gets { spectrum } back.

const N = 1024;

export function analyse(samples) {
    // window the frame, transform, return magnitudes
    return new Float32Array(N / 2);
}

export function render(ctx, t, { spectrum }) {
    // draw the magnitudes
}
`;

const MATHS_NOTE = `% Maths note - rendered with KaTeX, no audio.

X_k = \\sum_{n=0}^{N-1} x_n \\, e^{-i 2 \\pi k n / N}
`;

export const SKETCH_STARTERS: readonly SketchStarter[] = [
    {
        language: 'js',
        label: 'Blank canvas + audio out',
        seed: { name: 'blank canvas', language: 'js', tabs: { code: BLANK_CANVAS_CODE } },
    },
    {
        language: 'js',
        label: 'Windowed FFT scaffold',
        seed: { name: 'windowed fft', language: 'js', tabs: { code: FFT_SCAFFOLD_CODE } },
    },
    {
        language: 'tex',
        label: 'Maths note, no audio',
        seed: { name: 'maths note', language: 'tex', tabs: { maths: MATHS_NOTE } },
    },
];
