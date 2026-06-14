#!/usr/bin/env node
/* Enfold - a sixth preset for PhaseScope, by Fable.
 *
 * Seren asked for one about SHAPE, not colour: something that looks like
 * it is folding in on itself. Pure sines are welcome as long as it varies
 * and sounds good. So this is composed against the corridor's GEOMETRY.
 *
 * The mechanism. A ring is the 46ms window wrapped to a circle, with the
 * left channel pushed into x and the right into y (z stays clean). So the
 * cross-section of the tube is the Lissajous of L against R. For two sines
 * of the SAME pitch, that Lissajous is an ellipse whose openness is set by
 * the phase between the channels:
 *
 *     phase 0     -> a straight line   (the tube is folded flat, a blade)
 *     phase pi/2  -> a circle          (the tube is open, round)
 *     phase pi    -> the other line    (folded flat the other way)
 *
 * Detune the two channels by a fraction of a hertz and that phase drifts
 * continuously, so the ellipse breathes line -> circle -> line all the way
 * along the tube: a fold-wave running down the corridor, the surface
 * pleating flat and puffing open over and over. The detune sets the fold
 * spacing (more detune = tighter pleats); because xyScale (1.8) dwarfs the
 * frame spacing (0.08), neighbouring frames overlap into one continuous
 * folding SHEET rather than separate rings. Splitting a voice at the OCTAVE
 * (left f, right 2f) makes the cross-section a figure-of-eight, which
 * crosses itself - the sheet passing bodily through its own surface.
 *
 * Everything is just intonation on A, pure sine pairs, the detunes kept
 * sub-hertz so the folding reads as a slow Radigue-like beating rather than
 * sourness. Few voices at a time, sung loud, so the folds are deep.
 *
 * Run to perform:   node scripts/compose-enfold.mjs
 *
 * Four spans, 84 seconds - the sheet gathers, folds through itself, opens:
 *   I   draping   (0-22s)  two deep low voices, broad slow folds forming.
 *   II  gathering (18-46)  more pitches, each detuned differently; the
 *                          folds interfere into a pleated, moireing sheet.
 *   III through-  (42-64)  octave figure-eights cross the sheet through
 *       fold                itself; tight detunes pleat it hard - the climax.
 *   IV  opening   (60-84)  detunes relax toward unison; the folds open out,
 *                          slow, and settle - breathing, not flat-dead.
 */

import { writeFileSync, mkdirSync } from 'node:fs';

const SR = 44100;
const DUR = 84;
const N = SR * DUR;
const TAU = Math.PI * 2;
const Q = Math.PI / 2;

const L = new Float64Array(N);
const R = new Float64Array(N);

/* A sine pair. hzL/hzR may differ (detune for the fold-wave, or an octave
 * for the self-crossing eight); phiR sets the starting fold phase. Raised-
 * cosine envelope; an optional slow tremolo swells the fold depth. */
const voice = ({ t0, dur, hzL, hzR = hzL, amp, phiR = 0, envPow = 0.75, tremHz = 0, tremDepth = 0 }) => {
    const i0 = Math.floor(t0 * SR);
    const i1 = Math.min(N, Math.floor((t0 + dur) * SR));
    const len = i1 - i0;
    if (len <= 0) return;
    let phL = 0;
    let phR = phiR;
    const wL = (TAU * hzL) / SR;
    const wR = (TAU * hzR) / SR;
    for (let i = i0; i < i1; i++) {
        const t = (i - i0) / len;
        let env = Math.sin(Math.PI * t) ** envPow * amp;
        if (tremHz) env *= 1 - tremDepth + tremDepth * 0.5 * (1 + Math.sin(TAU * tremHz * ((i - i0) / SR)));
        phL += wL;
        phR += wR;
        L[i] += Math.sin(phL) * env;
        R[i] += Math.sin(phR) * env;
    }
};

/* 5-limit just intonation on A */
const A1 = 55;
const note = (ratio, oct = 0) => A1 * ratio * 2 ** oct;
const P1 = 1;
const M2 = 9 / 8;
const M3 = 5 / 4;
const P4 = 4 / 3;
const P5 = 3 / 2;
const M6 = 5 / 3;

/* ---- I: draping (0-22s) - two deep voices, broad slow folds ---- */
voice({ t0: 0.0, dur: 22, hzL: note(P1), hzR: note(P1) + 0.26, amp: 0.42, envPow: 0.7 }); // A1, fold ~every 83 frames
voice({ t0: 2.0, dur: 19, hzL: note(P5), hzR: note(P5) + 0.4, amp: 0.28, phiR: Math.PI / 3 }); // E2

/* ---- II: gathering (18-46) - more pitches, folds interfere/pleat ---- */
voice({ t0: 18, dur: 26, hzL: note(P1, 1), hzR: note(P1, 1) + 0.55, amp: 0.26 }); // A2
voice({ t0: 22, dur: 22, hzL: note(M3, 1), hzR: note(M3, 1) + 0.62, amp: 0.18, phiR: Q }); // C#3
voice({ t0: 26, dur: 20, hzL: note(P5, 1), hzR: note(P5, 1) + 0.72, amp: 0.16, phiR: Q }); // E3
// a slow just melody for variation, each note detuned so it folds as it sings
[
    [24, P5, 1],
    [30, M6, 1],
    [36, P1, 2],
    [40, P5, 1],
].forEach(([t, r, o], k) => voice({ t0: t, dur: 5.5, hzL: note(r, o), hzR: note(r, o) + 0.5, amp: 0.14, envPow: 0.9 }));

/* ---- III: through-fold (42-64) - octave eights + hard pleats ---- */
// Octave splits: cross-section is a figure-of-eight, the sheet self-crossing.
// A touch of detune makes the eight slowly tumble.
voice({ t0: 42, dur: 22, hzL: note(P1, 1), hzR: note(P1, 2) + 0.3, amp: 0.3, envPow: 0.8 }); // A2 vs A3
voice({ t0: 46, dur: 18, hzL: note(P5, 0), hzR: note(P5, 1) + 0.35, amp: 0.22, phiR: Q }); // E2 vs E3
// Tight detune = hard accordion pleats at the height.
voice({ t0: 48, dur: 14, hzL: note(P1, 2), hzR: note(P1, 2) + 1.15, amp: 0.18, tremHz: 0.5, tremDepth: 0.4 }); // A3

/* ---- IV: opening (60-84) - detunes relax toward unison, folds open ---- */
voice({ t0: 60, dur: 24, hzL: note(P1), hzR: note(P1) + 0.12, amp: 0.38, envPow: 1.0 }); // A1
voice({ t0: 62, dur: 21, hzL: note(P5), hzR: note(P5) + 0.15, amp: 0.24, phiR: Math.PI / 4 }); // E2
voice({ t0: 66, dur: 17, hzL: note(P1, 1), hzR: note(P1, 1) + 0.1, amp: 0.16 }); // A2

/* ---- self-check: the fold signature is a WIDE stereo-correlation swing.
 * line cross-section reads |corr|~1 (folded flat); open ellipse reads
 * corr~0. A span that sweeps the full range is folding. ---- */
const corrAt = (start, len) => {
    let eL = 0;
    let eR = 0;
    let eLR = 0;
    const i0 = Math.floor(start * SR);
    const i1 = Math.min(N, i0 + Math.floor(len * SR));
    for (let i = i0; i < i1; i++) {
        eL += L[i] * L[i];
        eR += R[i] * R[i];
        eLR += L[i] * R[i];
    }
    return eL > 1e-9 && eR > 1e-9 ? eLR / Math.sqrt(eL * eR) : NaN;
};
const span = (label, t0, t1) => {
    let lo = 1;
    let hi = -1;
    let any = false;
    for (let t = t0; t < t1; t += 0.12) {
        const c = corrAt(t, 0.12);
        if (Number.isFinite(c)) {
            lo = Math.min(lo, c);
            hi = Math.max(hi, c);
            any = true;
        }
    }
    const swing = any ? (hi - lo).toFixed(2) : 'n/a';
    console.log(`  ${label}  corr ${any ? lo.toFixed(2) : '  '} .. ${any ? hi.toFixed(2) : '  '}  (swing ${swing} - wide = folding)`);
};
console.log('fold self-check (cross-section collapses line<->circle as it folds):');
span('I   draping   ', 2, 20);
span('II  gathering ', 20, 44);
span('III throughfold', 44, 62);
span('IV  opening   ', 64, 82);

/* ---- normalize + write 16-bit stereo WAV (deep folds -> hotter peak) ---- */
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
if (!Number.isFinite(peak) || peak === 0) {
    throw new Error(`synthesis produced a degenerate signal (peak=${peak}) - refusing to write silence`);
}
const gain = 0.9 / peak;

const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
}

mkdirSync('public/audio', { recursive: true });
writeFileSync('public/audio/Enfold.wav', out);
console.log(`wrote public/audio/Enfold.wav (${(out.length / 1e6).toFixed(1)} MB, ${DUR}s)`);
