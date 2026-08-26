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

/* The discrete-time sinusoid from the course notes - every tab filled:
   code plays and draws x[n], maths renders the definition, notes carry
   the symbol legend. */
const SINUSOID_CODE = `// Sinusoidal function: x[n] = A cos(2 pi f n T + phi)
// A, f and phi come from the maths tab's assignments - edit them in the
// equation above the canvas, in the PARAMS bar, or in the maths tab
// itself; the values here are only fallbacks.
//
// This is a LIVE sketch: process() fills one block of samples at a time
// on the audio thread, reading the current params each block. So a value
// dragged while it plays bends the sound as you drag it - no RUN needed.
// (A sketch that exports audio() instead returns one finished buffer,
// and its params are fixed at RUN. Both styles work.)

export const seconds = 2;

// Phase has to CARRY between blocks - this is the whole reason a live
// oscillator accumulates instead of computing the angle from n.
// Working straight from the equation, angle = 2 pi f n T, means that the
// instant f changes the angle jumps to somewhere else on the circle, and
// a jump in the waveform is a click. Adding a step per sample instead
// lets f move freely: the angle stays exactly where it was and simply
// advances at a new rate.
let phase = 0;

export function process(out, { sampleRate, params }) {
    const { A = 0.4, f = 200, phi = 0 } = params;
    const step = (2 * Math.PI * f) / sampleRate; // radians per sample
    for (let i = 0; i < out.length; i++) {
        // Modulo, not a subtraction: f can be dragged negative or far past
        // the sample rate, and phase still has to stay bounded.
        phase = (phase + step) % (2 * Math.PI);
        out[i] = A * Math.cos(phase + phi);
    }
}

// The canvas is a scope: the horizontal axis is TIME, a fixed window of
// it, so f decides how many cycles fit on screen. Double f and you see
// twice as many. Shrink WINDOW_SECONDS to zoom in on fewer cycles.
const WINDOW_SECONDS = 0.02; // 20 ms - exactly 4 cycles at 200 Hz

export function render(ctx, t, { params }) {
    const { A = 0.4, f = 200, phi = 0 } = params;
    const w = ctx.canvas.clientWidth;
    const h = ctx.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = '#D5CFC2'; // zero axis
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Same formula as the audio, plotted against time instead of played.
    ctx.strokeStyle = '#1A1917';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
        // Where this pixel falls on the time axis, plus a slow scroll (a
        // quarter of the window per second) so the trace stays alive.
        // (Named tSec, not seconds - that name is the clip length above.)
        const tSec = (px / w) * WINDOW_SECONDS + t * WINDOW_SECONDS * 0.25;
        const x = A * Math.cos(2 * Math.PI * f * tSec + phi);
        const y = h / 2 - x * (h / 2) * 0.9; // A = 1 just fills the canvas
        if (px === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
    }
    ctx.stroke();
}
`;

const SINUSOID_MATHS = `x[n] = A \\cos(2 \\pi f n T + \\phi)
\\qquad
T = \\frac{1}{f_s}
\\\\[1.5ex]
A = 0.4, \\qquad f = 200, \\qquad \\phi = 0
`;

const SINUSOID_NOTES = `Sinusoidal functions (sinewaves)

A: amplitude
f: frequency in Hertz (cycles/second)
phi: initial phase in radians
n: time index
T = 1/fs: sampling period in seconds (t = nT = n/fs)

Try: press RUN, then drag f WHILE it plays - the pitch bends with your
pointer, because process() reads the params fresh every block. Sweep phi
and watch the wave slide sideways; halve A and hear it drop.

RUN is only needed after a code change now, not a value change.
`;

export const SKETCH_STARTERS: readonly SketchStarter[] = [
    {
        language: 'js',
        label: 'Sinusoid - A, f, phase',
        seed: {
            name: 'sinusoid',
            language: 'js',
            tabs: { code: SINUSOID_CODE, maths: SINUSOID_MATHS, notes: SINUSOID_NOTES },
        },
    },
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
