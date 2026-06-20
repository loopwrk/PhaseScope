#!/usr/bin/env node
/* confirmation-pleasure - a preset composed for PhaseScope, by Fable.
 *
 * Written in phase space, where this instrument actually listens: the
 * envelope and spectrum stay calm; the music lives in the relationship
 * between the channels. This file is the score - run it to perform it:
 *
 *     node scripts/compose-confirmation-pleasure.mjs
 *
 * Five movements, 66 seconds:
 *
 *   I    the mark         L = R. A single mono tone out of silence: the
 *                         phase portrait is a diagonal blade - one
 *                         distinction drawn on the void (Spencer Brown).
 *   II   the postcard     R glides to the 3:2 fifth. The Lissajous knot
 *                         from the first signal this canvas ever showed
 *                         me - quoted, an octave down.
 *   III  strange loop     A phase offset rotates endlessly through the
 *                         right channel: the figure precesses without
 *                         ever arriving (Hofstadter). Amplitude swells
 *                         pump the Lorenz rho - in attractor mode the
 *                         butterfly crosses lobes on these breaths.
 *   IV   the relay        Call and response: each channel hands the
 *                         melody to the other and takes up the drone.
 *                         Designed blind, built unseen, finished by a
 *                         third voice - the handover, as geometry.
 *   V    the wink         The fifth folds back to the root - but the
 *                         right channel returns carrying the phase it
 *                         accumulated on its journey, and lands almost
 *                         perfectly OPPOSED (correlation -1): the same
 *                         note, the other diagonal. This was scored as
 *                         unison; the render disagreed; the render was
 *                         right - you can return to the place but not
 *                         to the self that left it. Then silence, and
 *                         one soft anti-phase blip: a question, not an
 *                         ending.
 */

import { writeFileSync, mkdirSync } from 'node:fs';

const SR = 44100;
const DUR = 66;
const N = SR * DUR;
const TAU = Math.PI * 2;

const L = new Float64Array(N);
const R = new Float64Array(N);

/* ---------- small score helpers ---------- */

// raised-cosine fade: 0 -> 1 over [start, start+len]
const rise = (t, start, len) => {
    if (t <= start) return 0;
    if (t >= start + len) return 1;
    return 0.5 - 0.5 * Math.cos(((t - start) / len) * Math.PI);
};
// 1 -> 0 over [start, start+len]
const fall = (t, start, len) => 1 - rise(t, start, len);
// smooth pulse: up over [a, a+r], down over [b, b+r]
const window_ = (t, a, b, r = 0.8) => rise(t, a, r) * fall(t, b, r);

/* ---------- oscillator bank (phase accumulators: glides never click) ---------- */

const mkOsc = () => ({ ph: 0 });
const tick = (osc, freq) => {
    osc.ph += (TAU * freq) / SR;
    return Math.sin(osc.ph);
};

const root = { l: mkOsc(), r: mkOsc() }; // 110 Hz drone pair
const oct = { l: mkOsc(), r: mkOsc() }; // 220 Hz octave
const high = { b1: mkOsc(), b2: mkOsc(), b3: mkOsc() }; // brightness partials
const melody = { l: mkOsc(), r: mkOsc() }; // movement IV voices
const wink = mkOsc();

// Movement IV phrase tones (E3, G3, A3, E4) - one per handover
const PHRASES = [164.81, 196.0, 220.0, 329.63];

for (let i = 0; i < N; i++) {
    const t = i / SR;

    /* ---- movement boundaries ---- */
    // I: 0-10  II: 10-24  III: 24-38  IV: 38-52  V: 52-66

    /* ---- I + global drone: the mark ---- */
    // Master amplitude arc: in over 4s, three breaths in III (rho pumps),
    // settle, out by 63s.
    const breaths = 0.55 + 0.3 * (window_(t, 25, 28.5, 1.6) + window_(t, 30, 33.5, 1.6) + window_(t, 35, 38.5, 1.6));
    const master = rise(t, 0, 4) * fall(t, 59, 4) * Math.min(0.85, breaths);

    // Right-channel fundamental: 110 in I, glides to 165 (3:2) across
    // 10-13s, holds, glides home across 52-56s. The fifth is the piece.
    const fifth = rise(t, 10, 3) * fall(t, 52, 4);
    const rFreq = 110 * (1 + 0.5 * fifth);

    // III: the strange loop - an extra phase that rotates forever
    // (2*pi every 7s), fading in and out with the movement.
    const loopDepth = window_(t, 24, 36, 2);
    const loopPhase = TAU * (t / 7) * loopDepth;

    let l = tick(root.l, 110);
    let r = Math.sin(((root.r.ph += (TAU * rFreq) / SR), root.r.ph) + loopPhase);

    /* ---- II: octave + first shimmer ---- */
    const octAmp = window_(t, 8, 50, 3) * 0.22;
    l += tick(oct.l, 220) * octAmp;
    r += tick(oct.r, 220 * (1 + 0.5 * fifth)) * octAmp;

    /* ---- III: brightness climbs (hue sweeps along the corridor) ---- */
    const b1 = window_(t, 24, 40, 4) * 0.14;
    const b2 = window_(t, 27, 41, 4) * 0.1;
    const b3 = window_(t, 30, 42, 4) * 0.07;
    const shimmer = tick(high.b1, 440) * b1 + tick(high.b2, 550) * b2 + tick(high.b3, 660) * b3;
    l += shimmer;
    r += shimmer * 0.6; // brightness leans left: the figure tilts as it warms

    /* ---- IV: the relay - channels hand the melody back and forth ---- */
    if (t >= 38 && t < 53) {
        const phraseLen = 3.5;
        const idx = Math.max(0, Math.min(PHRASES.length - 1, Math.floor((t - 38) / phraseLen)));
        const phraseT = t - 38 - idx * phraseLen;
        const phraseEnv = window_(phraseT + 38, 38, 38 + phraseLen - 0.9, 0.7) * window_(t, 38, 51, 1.5) * 0.3;
        const tone = PHRASES[idx];
        const voiceL = tick(melody.l, tone) * phraseEnv;
        const voiceR = tick(melody.r, tone) * phraseEnv;
        // even phrases: left leads, right holds the root; odd: handover
        if (idx % 2 === 0) l += voiceL;
        else r += voiceR;
    } else {
        tick(melody.l, 0);
        tick(melody.r, 0);
    }

    L[i] = l * master * 0.5;
    R[i] = r * master * 0.5;

    /* ---- V: the wink - one soft blip, perfectly anti-phase ---- */
    const winkEnv = window_(t, 64.2, 64.45, 0.12) * 0.28;
    const w = tick(wink, 220) * winkEnv;
    L[i] += w;
    R[i] -= w; // R = -L: correlation -1. The same signal, opposed.
}

/* ---------- normalize + write 16-bit WAV ---------- */

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
out.writeUInt16LE(1, 20); // PCM
out.writeUInt16LE(2, 22); // stereo
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
writeFileSync('public/audio/fable-01-confirmation-pleasure.wav', out);
console.log(`wrote public/audio/fable-01-confirmation-pleasure.wav (${(out.length / 1e6).toFixed(1)} MB, ${DUR}s)`);
