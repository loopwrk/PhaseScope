/** Master output gain shared by the track player and the live synth: 85%
 *  leaves clipping headroom, and one constant keeps the two modes at the
 *  same loudness. */
export const OUTPUT_GAIN = 0.85;

/** Sample rate assumed wherever the corridor state hasn't one yet (before
 *  a track decodes / the synth ring arrives). Display-only estimates. */
export const FALLBACK_SR = 48000;
