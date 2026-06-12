import { describe, it, expect } from 'vitest';
import {
    midiNoteToHz,
    midiNoteName,
    pitchToPan,
    velocityToGain,
    PAN_LOW_NOTE,
    PAN_HIGH_NOTE,
    PAN_SPAN,
} from '~/utils/midi';

/* The pure maths under live-input mode: tuning, naming, and the
   pitch-panned stereo that gives the live figure its width. */

describe('midiNoteToHz', () => {
    it('tunes A4 (69) to 440Hz and doubles per octave', () => {
        expect(midiNoteToHz(69)).toBeCloseTo(440, 6);
        expect(midiNoteToHz(81)).toBeCloseTo(880, 6);
        expect(midiNoteToHz(57)).toBeCloseTo(220, 6);
    });

    it('places middle C (60) at the textbook 261.63Hz', () => {
        expect(midiNoteToHz(60)).toBeCloseTo(261.6256, 3);
    });
});

describe('midiNoteName', () => {
    it('names the landmarks', () => {
        expect(midiNoteName(60)).toBe('C4');
        expect(midiNoteName(69)).toBe('A4');
        expect(midiNoteName(70)).toBe('A#4');
        expect(midiNoteName(21)).toBe('A0'); // bottom of an 88-key piano
        expect(midiNoteName(108)).toBe('C8'); // top of it
    });
});

describe('pitchToPan', () => {
    it('centres the middle of the span and clamps outside it', () => {
        expect(pitchToPan((PAN_LOW_NOTE + PAN_HIGH_NOTE) / 2)).toBeCloseTo(0, 10);
        expect(pitchToPan(PAN_LOW_NOTE - 12)).toBe(-PAN_SPAN);
        expect(pitchToPan(PAN_HIGH_NOTE + 12)).toBe(PAN_SPAN);
    });

    it('never reaches full pan - every voice keeps both channels alive', () => {
        expect(Math.abs(pitchToPan(0))).toBeLessThan(1);
        expect(Math.abs(pitchToPan(127))).toBeLessThan(1);
    });

    it('rises monotonically: higher notes sit further right', () => {
        for (let n = PAN_LOW_NOTE; n < PAN_HIGH_NOTE; n++) {
            expect(pitchToPan(n + 1)).toBeGreaterThan(pitchToPan(n));
        }
    });
});

describe('velocityToGain', () => {
    it('maps the full range to [0, 1]', () => {
        expect(velocityToGain(0)).toBe(0);
        expect(velocityToGain(127)).toBeCloseTo(1, 10);
    });

    it('curves below linear: soft touches stay soft', () => {
        expect(velocityToGain(64)).toBeLessThan(64 / 127);
        expect(velocityToGain(64)).toBeGreaterThan(0.2);
    });
});
