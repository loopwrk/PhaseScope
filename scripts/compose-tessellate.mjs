#!/usr/bin/env node
/* Tessellate - a seventh preset for PhaseScope, by Fable.
 *
 * The square-wave sibling of Enfold, to Seren's brief: same folding shape
 * language, but square waves, a bigger left/right difference, a little
 * louder, a wider pitch range, and a steady four-to-the-floor kick up in a
 * fairly high register.
 *
 * The fold engine is Enfold's: the corridor cross-section is the L-vs-R
 * Lissajous, so detuning the channels makes it breathe line -> circle ->
 * line, a fold-wave down the tube. Two changes sharpen and widen it:
 *
 *   SQUARE not sine.  Each voice is a band-limited square - odd harmonics
 *   1,3,5..  at 1/n, summed only while they stay under Nyquist (so it is
 *   crisp but never aliases). On a ring a square steps between its rails
 *   instead of rippling, so the folds come out angular and faceted -
 *   tessellated - rather than as Enfold's smooth curls. (The odd harmonics
 *   also lift the colour off pure blue, a free bonus.)
 *
 *   WIDER L/R.  Bigger detunes than Enfold, and more voices split across
 *   the ears by a just OCTAVE (figure-of-eight, self-crossing) or FIFTH
 *   (a 2:3 knot) - so the two channels genuinely disagree and the tube
 *   blooms and folds wider, while staying consonant.
 *
 * Over all of it, a 120bpm kick on every beat (a high ~250Hz body with a
 * bright click) and offbeat hats panned left/right. Each hit is a sharp,
 * bright, near-mono ring - a rhythmic vertebra punctuating the wide folded
 * tube. Just intonation on A; normalized hot (0.95) so it lands harder.
 *
 * Run to perform:   node scripts/compose-tessellate.mjs
 *
 * 84 seconds, four spans over a steady beat - the lattice folds and opens:
 *   I   (0-24)   low square folds; octave eights; the beat drops at 4s.
 *   II  (18-46)  wider register, fifth-splits, a square melody on the grid.
 *   III (42-66)  octave eights + tight detunes: the hard, faceted climax.
 *   IV  (62-84)  detunes relax, folds open, the lattice settles - beat out.
 */

import { writeFileSync, mkdirSync } from 'node:fs';

const SR = 44100;
const DUR = 84;
const N = SR * DUR;
const TAU = Math.PI * 2;
const Q = Math.PI / 2;
const NYQ = 0.45 * SR;

const L = new Float64Array(N);
const R = new Float64Array(N);

// deterministic noise (mulberry32) for drum clicks/hats - reproducible file
let _s = 0x9e3779b9;
const rnd = () => {
    _s = (_s + 0x6d2b79f5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
};

const ODD = [1, 3, 5, 7, 9, 11, 13, 15];
const NORM = ODD.reduce((s, n) => s + 1 / n, 0);

/* A band-limited square pair. hzL/hzR differ for the fold-wave (detune) or
 * a just split (octave/fifth). phiR is applied as n*phiR per harmonic so R
 * stays a cleanly time-shifted square. Raised-cosine envelope; optional
 * tremolo swells the fold depth. */
const sq = ({ t0, dur, hzL, hzR = hzL, amp, phiR = 0, envPow = 0.7, tremHz = 0, tremDepth = 0 }) => {
    const i0 = Math.floor(t0 * SR);
    const i1 = Math.min(N, Math.floor((t0 + dur) * SR));
    const len = i1 - i0;
    if (len <= 0) return;
    for (let i = i0; i < i1; i++) {
        const t = (i - i0) / SR;
        const tt = (i - i0) / len;
        let env = Math.sin(Math.PI * tt) ** envPow * amp;
        if (tremHz) env *= 1 - tremDepth + tremDepth * 0.5 * (1 + Math.sin(TAU * tremHz * t));
        let sl = 0;
        let sr = 0;
        for (let k = 0; k < ODD.length; k++) {
            const n = ODD[k];
            const a = 1 / n;
            if (hzL * n < NYQ) sl += a * Math.sin(TAU * hzL * n * t);
            if (hzR * n < NYQ) sr += a * Math.sin(TAU * hzR * n * t + n * phiR);
        }
        L[i] += (env * sl) / NORM;
        R[i] += (env * sr) / NORM;
    }
};

/* Four-to-the-floor kick: a fairly high pitched body (~250Hz) with a fast
 * pitch drop and a bright click. Centred, so each hit reads as a sharp,
 * bright, near-mono ring. */
const kick = (t0, { amp = 0.5, pitch = 250, drop = 1.7, decay = 0.11, clickAmp = 0.32 } = {}) => {
    const i0 = Math.floor(t0 * SR);
    const i1 = Math.min(N, i0 + Math.floor(0.3 * SR));
    let ph = 0;
    for (let i = i0; i < i1; i++) {
        const tt = (i - i0) / SR;
        const f = pitch * (1 + (drop - 1) * Math.exp(-tt / 0.018));
        ph += (TAU * f) / SR;
        const body = Math.sin(ph) * Math.exp(-tt / decay);
        const cEnv = Math.exp(-tt / 0.0035);
        const click = (Math.sin(TAU * 2700 * tt) + 0.7 * Math.sin(TAU * 5300 * tt) + 0.6 * rnd()) * cEnv * clickAmp;
        const v = (body + click) * amp;
        L[i] += v;
        R[i] += v;
    }
};

/* Offbeat hat: a short bright noise tick, panned hard L or R for motion. */
const hat = (t0, { amp = 0.16, pan = 0 } = {}) => {
    const i0 = Math.floor(t0 * SR);
    const i1 = Math.min(N, i0 + Math.floor(0.05 * SR));
    const gl = pan <= 0 ? 1 : 0.35;
    const gr = pan >= 0 ? 1 : 0.35;
    for (let i = i0; i < i1; i++) {
        const tt = (i - i0) / SR;
        const v = rnd() * Math.exp(-tt / 0.012) * amp;
        L[i] += v * gl;
        R[i] += v * gr;
    }
};

/* 5-limit just intonation on A */
const A1 = 55;
const J = (ratio, oct = 0) => A1 * ratio * 2 ** oct;
const P1 = 1;
const M2 = 9 / 8;
const M3 = 5 / 4;
const P4 = 4 / 3;
const P5 = 3 / 2;
const M6 = 5 / 3;

/* ---- I: low square folds + octave eights (0-24) ---- */
sq({ t0: 0, dur: 24, hzL: J(P1), hzR: J(P1) + 1.5, amp: 0.34, envPow: 0.65 }); // A1, detune fold (wide)
sq({ t0: 2, dur: 21, hzL: J(P5, 0), hzR: J(P5, 1) + 0.5, amp: 0.24, phiR: Q }); // E2 vs E3 (octave eight)

/* ---- II: wider register, fifth-splits, square melody (18-46) ---- */
sq({ t0: 18, dur: 28, hzL: J(P1, 1), hzR: J(P1, 1) + 2.4, amp: 0.24 }); // A2, big detune
sq({ t0: 22, dur: 22, hzL: J(P1, 1), hzR: J(P5, 1), amp: 0.18, phiR: Q }); // A2 vs E3 (fifth, 2:3 knot)
sq({ t0: 26, dur: 20, hzL: J(M3, 1), hzR: J(M3, 1) + 1.9, amp: 0.15, phiR: Q }); // C#3 detune

/* ---- III: octave eights + tight detunes, the faceted climax (42-66) ---- */
sq({ t0: 42, dur: 24, hzL: J(P1, 1), hzR: J(P1, 2) + 0.5, amp: 0.24, envPow: 0.75 }); // A2 vs A3 eight
sq({ t0: 46, dur: 18, hzL: J(M3, 1), hzR: J(M3, 2) + 0.6, amp: 0.18, phiR: Q }); // C#3 vs C#4 eight
sq({ t0: 48, dur: 14, hzL: J(P1, 2), hzR: J(P1, 2) + 3.0, amp: 0.15, tremHz: 0.5, tremDepth: 0.4 }); // A3 hard pleats

/* ---- IV: open out, settle (62-84) ---- */
sq({ t0: 62, dur: 22, hzL: J(P1), hzR: J(P1) + 0.4, amp: 0.32, envPow: 0.95 }); // A1
sq({ t0: 64, dur: 19, hzL: J(P5), hzR: J(P5) + 0.6, amp: 0.22, phiR: Math.PI / 4 }); // E2
sq({ t0: 68, dur: 15, hzL: J(P1, 1), hzR: J(P1, 1) + 0.3, amp: 0.15 }); // A2

/* ---- wide-range square melody on the grid (variation), II-III ---- */
// just A-pentatonic, spanning A2..C#5; each note split L:R by an octave
// (figure-eight) so it folds as it sings; rhythm sits on the beat.
const mel = [
    [24, P5, 1],
    [25, M6, 1],
    [26, P1, 2],
    [28, M3, 2],
    [30, P5, 2],
    [31, M6, 2],
    [32, P1, 3],
    [36, M3, 2],
    [38, P5, 2],
    [40, M3, 3],
    [44, M6, 2],
    [46, P1, 3],
    [48, M3, 3],
    [50, P5, 3],
    [52, M3, 3],
    [54, P1, 3],
];
mel.forEach(([t, r, o]) => sq({ t0: t, dur: 1.6, hzL: J(r, o), hzR: J(r, o + 1) + 0.4, amp: 0.1, envPow: 0.5 }));

/* ---- the steady four-to-the-floor + offbeat hats (4s .. 80s) ---- */
const BPM = 120;
const beat = 60 / BPM;
let bi = 0;
for (let t = 4; t < 80; t += beat, bi++) {
    kick(t);
    hat(t + beat / 2, { pan: bi % 2 ? 1 : -1 });
}

/* ---- self-check: folding (corr swing), width (mean |corr|), and beat ---- */
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
const rmsAt = (start, len) => {
    let e = 0;
    const i0 = Math.floor(start * SR);
    const i1 = Math.min(N, i0 + Math.floor(len * SR));
    for (let i = i0; i < i1; i++) e += L[i] * L[i] + R[i] * R[i];
    return Math.sqrt(e / (2 * (i1 - i0)));
};
let lo = 1;
let hi = -1;
let absSum = 0;
let cnt = 0;
for (let t = 6; t < 78; t += 0.13) {
    const c = corrAt(t, 0.13);
    if (Number.isFinite(c)) {
        lo = Math.min(lo, c);
        hi = Math.max(hi, c);
        absSum += Math.abs(c);
        cnt++;
    }
}
console.log('self-check:');
console.log(`  fold swing       corr ${lo.toFixed(2)} .. ${hi.toFixed(2)}  (wide = folding)`);
console.log(`  stereo width     mean|corr| ${(absSum / cnt).toFixed(2)}  (lower = bigger L/R difference)`);
console.log(`  beat (on/off)    rms@kick ${rmsAt(20.0, 0.06).toFixed(3)}  vs between ${rmsAt(20.25, 0.06).toFixed(3)}`);

/* ---- normalize (hot) + write 16-bit stereo WAV ---- */
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
if (!Number.isFinite(peak) || peak === 0) {
    throw new Error(`synthesis produced a degenerate signal (peak=${peak}) - refusing to write silence`);
}
const gain = 0.95 / peak;

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
writeFileSync('public/audio/Tessellate.wav', out);
console.log(`wrote public/audio/Tessellate.wav (${(out.length / 1e6).toFixed(1)} MB, ${DUR}s)`);
