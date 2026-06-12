/* Live-synth voice presets - the brushes of live mode.

   Pure data (no Web Audio) so the session card, the settings panel and
   the synth all read one table, and it stays unit-testable. Each preset
   is tuned for a FIGURE as much as a sound: the visualiser eats
   harmonics, so timbre choices are geometry choices.

     warm    two detuned saws through a lowpass - harmonic fur for the
             corridor, slow beating that sets the Lissajous figure
             precessing. The original instrument.
     pure    a single undetuned sine - the canonical Lissajous input.
             Intervals draw their textbook curves: silk, not fur.
     hollow  detuned squares - ODD harmonics only, the clarinet recipe;
             a different symmetry family of figures.
     glass   sine plus a quiet octave partial - every note carries a
             faint figure-of-eight inside it, bell-adjacent. */

export type LiveVoiceId = 'warm' | 'pure' | 'hollow' | 'glass';

export interface LiveVoiceDef {
    label: string;
    /** One line for the UI - what it sounds like, what it draws */
    hint: string;
    wave: OscillatorType;
    /** Cents of detune split between the oscillator pair (+/- half each) */
    detune: number;
    /** Second oscillator's frequency ratio vs the note (0 = no second osc) */
    bRatio: number;
    /** Second oscillator's level relative to the first */
    bLevel: number;
    /** Lowpass cutoff as a multiple of the fundamental (0 = no filter) */
    filterMult: number;
    /** Loudness compensation (perceived level varies a lot by wave) */
    gain: number;
}

export const LIVE_VOICES: Record<LiveVoiceId, LiveVoiceDef> = {
    warm: {
        label: 'Warm',
        hint: 'Two detuned saws - furry texture, slowly turning figures.',
        wave: 'sawtooth',
        detune: 12,
        bRatio: 1,
        bLevel: 1,
        filterMult: 6,
        gain: 1,
    },
    pure: {
        label: 'Pure',
        hint: 'A single sine - textbook Lissajous curves, silk-clean.',
        wave: 'sine',
        detune: 0,
        bRatio: 0,
        bLevel: 0,
        filterMult: 0,
        gain: 1.3,
    },
    hollow: {
        label: 'Hollow',
        hint: 'Squares - odd harmonics only, a different figure family.',
        wave: 'square',
        detune: 8,
        bRatio: 1,
        bLevel: 0.85,
        filterMult: 4,
        gain: 0.6,
    },
    glass: {
        label: 'Glass',
        hint: 'Sine + quiet octave - a figure-of-eight inside every note.',
        wave: 'sine',
        detune: 4,
        bRatio: 2,
        bLevel: 0.35,
        filterMult: 0,
        gain: 1.15,
    },
};

export const LIVE_VOICE_IDS = Object.keys(LIVE_VOICES) as LiveVoiceId[];
