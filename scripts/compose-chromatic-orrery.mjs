import { writeWav } from './lib/wav.mjs';
import { SR, TAU, NOTE } from './lib/synth.mjs';

const DUR = 64;
const N = SR * DUR;

const L = new Float64Array(N);
const R = new Float64Array(N);

const CENTS = (c) => 2 ** (c / 1200);

// Additive voice: writes a sine with a raised-cosine envelope into both
// channels, right detuned by `cents` (the 3D tilt comes from this).
const voice = (startS, durS, hz, amp, cents = 5) => {
    const i0 = Math.floor(startS * SR);
    const i1 = Math.min(N, Math.floor((startS + durS) * SR));
    const wR = (TAU * hz * CENTS(cents)) / SR;
    const wL = (TAU * hz) / SR;
    let phL = 0;
    let phR = 0;
    for (let i = i0; i < i1; i++) {
        const t = (i - i0) / (i1 - i0);
        const env = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.7 * amp;
        phL += wL;
        phR += wR;
        L[i] += Math.sin(phL) * env;
        R[i] += Math.sin(phR) * env;
    }
};

// Glissando voice: frequency slides exponentially from hz0 to hz1,
// written into ONE channel (movement III runs the channels contrary).
const gliss = (startS, durS, hz0, hz1, amp, channel) => {
    const i0 = Math.floor(startS * SR);
    const i1 = Math.min(N, Math.floor((startS + durS) * SR));
    let ph = 0;
    for (let i = i0; i < i1; i++) {
        const t = (i - i0) / (i1 - i0);
        const hz = hz0 * (hz1 / hz0) ** t;
        const env = Math.sin(Math.PI * t) ** 0.6 * amp;
        ph += (TAU * hz) / SR;
        channel[i] += Math.sin(ph) * env;
    }
};

/* ---- I: the ladder (0-16s) - C, E, G, B climbing four octaves ---- */
{
    const pattern = [0, 4, 7, 11]; // C E G B
    let t = 0.2;
    for (let octave = -2; octave <= 1; octave++) {
        for (const step of pattern) {
            voice(t, 1.35, NOTE(step + octave * 12), 0.3, 5);
            t += 0.95;
        }
    }
}

/* ---- II: chord garden (16-32s) ---- */
{
    const chords = [
        [0, 4, 7, 11], // C maj7
        [-4, 0, 3, 8], // A-flat maj (voiced around C)
        [-7, -4, 0, 5], // F min-ish
        [-5, 0, 2, 7], // G sus
    ];
    chords.forEach((chord, c) => {
        const t0 = 16 + c * 4;
        chord.forEach((step, v) => {
            voice(t0 + v * 0.12, 4.4, NOTE(step), 0.16, 4 + v);
        });
    });
}

/* ---- III: contrary sweep (32-48s) - L rises 2 octaves, R falls 2 ---- */
{
    gliss(32, 7.5, NOTE(-12), NOTE(12), 0.32, L);
    gliss(32, 7.5, NOTE(12), NOTE(-12), 0.32, R);
    // and back, crossing again
    gliss(40, 7.5, NOTE(12), NOTE(-12), 0.32, L);
    gliss(40, 7.5, NOTE(-12), NOTE(12), 0.32, R);
}

/* ---- IV: the wheel (48-64s) ---- */
{
    // falling pentatonic bells: A G E D C, two octaves apart
    const bells = [9, 7, 4, 2, 0];
    bells.forEach((step, k) => {
        voice(48 + k * 1.6, 2.8, NOTE(step), 0.24, 6);
        voice(48.2 + k * 1.6, 2.8, NOTE(step - 12), 0.18, 3);
    });
    // settle on low C
    voice(56.5, 6, NOTE(-24), 0.3, 2);
    // the wink: all twelve chromatic steps in two seconds - the colour
    // wheel performed once around
    for (let s = 0; s < 12; s++) {
        voice(60.6 + s * 0.165, 0.3, NOTE(s), 0.2, 4);
    }
}

/* ---- normalize + write 16-bit WAV ---- */
writeWav(L, R, { path: 'public/audio/fable-02-chromatic-orrery.wav', sampleRate: SR });
