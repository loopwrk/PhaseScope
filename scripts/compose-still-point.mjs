#!/usr/bin/env node
/* the still point - a third preset for PhaseScope, by Fable.
 *
 * Written to commemorate the session in which PhaseScope became an
 * instrument: the live mode, the session card, the countdown rail, and
 * a collaboration that treated both parties as collaborators.
 *
 *   "at the still point, there the dance is."  - T.S. Eliot
 *
 * The thesis: consonance IS phase geometry. The intervals that sound
 * sweetest - unison, octave, perfect fifth - are exactly the frequency
 * ratios that draw the cleanest Lissajous figures. So every movement is
 * an interval, and every interval is a figure. Unusual phase states,
 * nothing but consonance. Watch the goniometer.
 *
 * Run to perform:   node scripts/compose-still-point.mjs
 *
 * Five movements, 72 seconds:
 *
 *   I    circles        Tones in QUADRATURE: the right channel runs 90
 *        (0-14s)        degrees behind the left. Same note, both ears -
 *                       but the figure is a perfect breathing circle
 *                       (correlation 0 while sounding like unison).
 *   II   figures of     The OCTAVE, split across space: left carries the
 *        eight (14-28)  melody, right sings it an octave up. Ratio 1:2 -
 *                       every note draws a figure-of-eight.
 *   III  trefoils       The PERFECT FIFTH as geometry: left plays roots,
 *        (28-44)        right the just fifth (exactly 3:2), drawing the
 *                       pretzel-knot Lissajous of three against two.
 *   IV   the phase      One warm tone whose interchannel phase rotates a
 *        wheel (44-62)  full turn over sixteen seconds: diagonal line ->
 *                       ellipse -> circle -> counter-line -> home again.
 *                       Correlation sweeps +1 -> 0 -> -1 -> 0 -> +1 while
 *                       the EAR hears one unwavering note. A sparse mono
 *                       melody floats above, dead-centre.
 *   V    still point    Everything converges to MONO UNISON: the figure
 *        (62-72)        collapses to the single diagonal line, the
 *                       simplest figure there is. confirmation-pleasure
 *                       ended at correlation -1.00; this piece ends at
 *                       +1.00. The end of one arrives as the mirror of
 *                       the other - Mobius rules apply.
 */

import { writeFileSync, mkdirSync } from 'node:fs';

const SR = 44100;
const DUR = 72;
const N = SR * DUR;
const TAU = Math.PI * 2;

const L = new Float64Array(N);
const R = new Float64Array(N);

const NOTE = (semisFromC4) => 261.6256 * 2 ** (semisFromC4 / 12);

/* The one voice this piece needs: a sine pair with independent left and
 * right frequencies, an initial right-channel phase offset, and an
 * optional slow phase DRIFT (radians accumulated across the whole note).
 * Raised-cosine envelope; envPow shapes attack character. */
const voice = ({ t0, dur, hzL, hzR = hzL, amp, phiR = 0, drift = 0, envPow = 0.8 }) => {
    const i0 = Math.floor(t0 * SR);
    const i1 = Math.min(N, Math.floor((t0 + dur) * SR));
    const len = i1 - i0;
    let phL = 0;
    let phR = phiR;
    const wL = (TAU * hzL) / SR;
    const wR = (TAU * hzR) / SR;
    const dDrift = drift / len;
    for (let i = i0; i < i1; i++) {
        const t = (i - i0) / len;
        const env = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** envPow * amp;
        phL += wL;
        phR += wR + dDrift;
        L[i] += Math.sin(phL) * env;
        R[i] += Math.sin(phR) * env;
    }
};

const Q = Math.PI / 2; // quadrature: the circle's phase

/* ---- I: circles (0-14s) - quadrature swells on an A-major triad ---- */
voice({ t0: 0.3, dur: 13, hzL: NOTE(-3), amp: 0.4, phiR: Q }); // A3
voice({ t0: 3.5, dur: 9.5, hzL: NOTE(4), amp: 0.2, phiR: Q }); // E4
voice({ t0: 7.0, dur: 6.5, hzL: NOTE(9), amp: 0.14, phiR: Q }); // A4

/* ---- II: figures of eight (14-28s) - melody octave-split L:R = 1:2 ---- */
{
    // A pentatonic phrase; each note's right channel sings the exact octave
    const phrase = [2, 4, 6, 9, 11, 9, 6, 4]; // D E F# A B A F# E
    phrase.forEach((step, k) => {
        const f = NOTE(step);
        voice({ t0: 14.5 + k * 1.55, dur: 2.6, hzL: f, hzR: f * 2, amp: 0.26 });
    });
}

/* ---- III: trefoils (28-44s) - roots left, just fifths (3:2) right ---- */
{
    const roots = [-10, -7, -5, -3]; // D3 F3 G3 A3
    roots.forEach((step, k) => {
        const f = NOTE(step);
        voice({ t0: 28.5 + k * 3.8, dur: 4.6, hzL: f, hzR: f * 1.5, amp: 0.34 });
        // a quiet octave halo over the root, also 3:2 against the fifth
        voice({ t0: 28.7 + k * 3.8, dur: 4.2, hzL: f * 2, hzR: f * 3, amp: 0.1 });
    });
}

/* ---- IV: the phase wheel (44-62s) ---- */
// One warm tone, one full rotation: corr +1 -> 0 -> -1 -> 0 -> +1
voice({ t0: 44.5, dur: 17, hzL: NOTE(-15), amp: 0.42, drift: TAU, envPow: 0.5 }); // A2
voice({ t0: 44.5, dur: 17, hzL: NOTE(-3), amp: 0.1, drift: TAU, envPow: 0.5 }); // A3 halo, wheeling too
// Sparse mono melody dead-centre, so the wheel stays legible beneath
[
    { t: 47, s: 9, d: 3.0, a: 0.13 }, // A4
    { t: 51, s: 13, d: 3.0, a: 0.12 }, // C#5
    { t: 55, s: 16, d: 4.0, a: 0.11 }, // E5
].forEach(({ t, s, d, a }) => voice({ t0: t, dur: d, hzL: NOTE(s), amp: a }));

/* ---- V: still point (62-72s) - mono unison, the diagonal line ---- */
voice({ t0: 62, dur: 8.5, hzL: NOTE(-3), amp: 0.34, envPow: 0.6 }); // A3, both channels identical
voice({ t0: 62.3, dur: 7.5, hzL: NOTE(9), amp: 0.16, envPow: 0.6 }); // A4
voice({ t0: 67.5, dur: 3.6, hzL: NOTE(21), amp: 0.1 }); // A5: the point itself

/* ---- self-check: the piece validates its own geometry ---- */
const corr = (start, len) => {
    let eL = 0,
        eR = 0,
        eLR = 0;
    const i0 = Math.floor(start * SR);
    const i1 = Math.min(N, i0 + Math.floor(len * SR));
    for (let i = i0; i < i1; i++) {
        eL += L[i] * L[i];
        eR += R[i] * R[i];
        eLR += L[i] * R[i];
    }
    return eL > 1e-9 && eR > 1e-9 ? (eLR / Math.sqrt(eL * eR)).toFixed(2) : 'silence';
};
console.log('geometry self-check (correlation):');
console.log(`  I   circles      [2-12s]   ${corr(2, 10)}   (expect ~0: quadrature)`);
console.log(`  II  eights       [16-26s]  ${corr(16, 10)}  (expect ~0: octave ratio)`);
console.log(`  III trefoils     [30-42s]  ${corr(30, 12)}  (expect ~0: fifth ratio)`);
console.log(`  IV  wheel start  [45-46s]  ${corr(45, 1)}   (expect ~+1: line)`);
console.log(`  IV  wheel mid    [52.5-54] ${corr(52.5, 1.5)}  (expect ~-1: counter-line)`);
console.log(`  V   still point  [64-70s]  ${corr(64, 6)}   (expect +1.00: home)`);

/* ---- normalize + write 16-bit WAV ---- */
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
if (!Number.isFinite(peak) || peak === 0) {
    throw new Error(`synthesis produced a degenerate signal (peak=${peak}) - refusing to write silence`);
}
const gain = 0.78 / peak;

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
writeFileSync('public/audio/fable-03-the-still-point.wav', out);
console.log(`wrote public/audio/fable-03-the-still-point.wav (${(out.length / 1e6).toFixed(1)} MB, ${DUR}s)`);
