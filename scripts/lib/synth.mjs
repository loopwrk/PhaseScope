/* Shared synthesis constants and the equal-tempered note helper for the preset
   composers. The timbre - each piece's voice/oscillator design - stays in the
   composer; this is only the common math they all agreed on. */

export const SR = 44100; // sample rate, Hz
export const TAU = Math.PI * 2;

// Equal-tempered frequency for a note given in semitones from middle C
// (C4 = 261.6256 Hz).
export const NOTE = (semisFromC4) => 261.6256 * 2 ** (semisFromC4 / 12);
