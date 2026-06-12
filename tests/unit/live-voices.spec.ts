import { describe, it, expect } from 'vitest';
import { LIVE_VOICES, LIVE_VOICE_IDS } from '~/utils/liveVoices';

/* The voice table drives the synth's per-note audio graph AND two UI
   surfaces; a malformed entry would fail silently at note time. */

describe('live voice presets', () => {
    it('every voice is fully described', () => {
        for (const id of LIVE_VOICE_IDS) {
            const v = LIVE_VOICES[id];
            expect(v.label.length).toBeGreaterThan(0);
            expect(v.hint.length).toBeGreaterThan(0);
            expect(v.gain).toBeGreaterThan(0);
            expect(v.detune).toBeGreaterThanOrEqual(0);
            expect(v.filterMult).toBeGreaterThanOrEqual(0);
        }
    });

    it('second-oscillator settings are consistent', () => {
        for (const id of LIVE_VOICE_IDS) {
            const v = LIVE_VOICES[id];
            if (v.bRatio === 0) expect(v.bLevel).toBe(0);
            else expect(v.bLevel).toBeGreaterThan(0);
        }
    });

    it('pure is the canonical Lissajous input: one undetuned sine, no filter', () => {
        expect(LIVE_VOICES.pure).toMatchObject({ wave: 'sine', detune: 0, bRatio: 0, filterMult: 0 });
    });

    it('warm stays the default-shaped instrument (the original patch)', () => {
        expect(LIVE_VOICES.warm.wave).toBe('sawtooth');
        expect(LIVE_VOICES.warm.gain).toBe(1);
    });
});
