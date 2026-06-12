/* MIDI math - pure helpers under the live-input mode.
   Kept free of Web MIDI / Web Audio so the mapping logic is unit-testable. */
import { clamp } from '~/utils/utilities';

/** Equal temperament around A4 = 440Hz (MIDI note 69). */
export const midiNoteToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Human-readable note name, e.g. 60 -> "C4" (middle C). */
export const midiNoteName = (note: number): string => {
    const n = Math.round(note);
    return `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
};

/* Pitch-panned stereo - the Music Mouse nod, and the reason the live
   figure has any width at all: low notes lean left, high notes lean
   right, so intervals open the phase space instead of collapsing it to
   the mono diagonal. The span maps a typical keyboard (C2..C7) onto
   +-0.8, clamped outside it; never full +-1 so every voice keeps a
   presence in both channels (pure one-channel content would pin the
   goniometer to a flat axis). */
export const PAN_LOW_NOTE = 36; // C2
export const PAN_HIGH_NOTE = 96; // C7
export const PAN_SPAN = 0.8;

export const pitchToPan = (note: number): number => {
    const t = (note - PAN_LOW_NOTE) / (PAN_HIGH_NOTE - PAN_LOW_NOTE);
    return (clamp(t, 0, 1) * 2 - 1) * PAN_SPAN;
};

/** Velocity (0..127) to gain, perceptually curved: quiet keys stay
 *  audible, hard strikes don't clip the bus. */
export const velocityToGain = (velocity: number): number => (clamp(velocity, 0, 127) / 127) ** 1.6;
