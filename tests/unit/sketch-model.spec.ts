import { describe, it, expect } from 'vitest';
import {
    createSketch,
    duplicateName,
    byRecency,
    languageCounts,
    relativeTimeLabel,
    type Sketch,
} from '~/utils/sketch/model';

const at = (updatedAt: number, name = `s${updatedAt}`): Sketch => ({
    ...createSketch({ id: name, now: updatedAt, name }),
    updatedAt,
});

describe('createSketch', () => {
    it('fills the spec defaults', () => {
        const s = createSketch({ id: 'a', now: 1000 });
        expect(s).toMatchObject({
            id: 'a',
            name: 'untitled',
            language: 'js',
            aspect: 'fit',
            preferredRatio: 16 / 9,
            thumbnail: null,
            createdAt: 1000,
            updatedAt: 1000,
        });
        expect(s.tabs).toEqual({ code: '', maths: '', notes: '' });
    });

    it('accepts seed overrides, merging partial tabs', () => {
        const s = createSketch({ id: 'b', now: 0, name: 'fft', language: 'tex', tabs: { maths: 'x^2' } });
        expect(s.name).toBe('fft');
        expect(s.language).toBe('tex');
        expect(s.tabs).toEqual({ code: '', maths: 'x^2', notes: '' });
    });
});

describe('duplicateName', () => {
    it('appends "copy" when free', () => {
        expect(duplicateName('dft-basis-sweep', ['dft-basis-sweep'])).toBe('dft-basis-sweep copy');
    });

    it('numbers subsequent copies past every taken label', () => {
        const taken = ['wave', 'wave copy', 'wave copy 2'];
        expect(duplicateName('wave', taken)).toBe('wave copy 3');
    });
});

describe('byRecency', () => {
    it('orders most recently touched first without mutating the input', () => {
        const input = [at(1), at(3), at(2)];
        const sorted = byRecency(input);
        expect(sorted.map((s) => s.updatedAt)).toEqual([3, 2, 1]);
        expect(input.map((s) => s.updatedAt)).toEqual([1, 3, 2]);
    });
});

describe('languageCounts', () => {
    it('tallies per language', () => {
        const sketches = [
            createSketch({ id: '1', now: 0 }),
            createSketch({ id: '2', now: 0 }),
            createSketch({ id: '3', now: 0, language: 'tex' }),
        ];
        expect(languageCounts(sketches)).toEqual({ js: 2, tex: 1 });
    });
});

describe('relativeTimeLabel', () => {
    const MINUTE = 60_000;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;

    it.each([
        [30_000, 'JUST NOW'],
        [2 * MINUTE, '2M AGO'],
        [3 * HOUR, '3H AGO'],
        [30 * HOUR, 'YESTERDAY'],
        [3 * DAY, '3D AGO'],
        [10 * DAY, '1W AGO'],
        [45 * DAY, '1MO AGO'],
        [400 * DAY, '1Y AGO'],
    ])('%ims ago -> %s', (elapsed, label) => {
        expect(relativeTimeLabel(1_000_000_000, 1_000_000_000 + elapsed)).toBe(label);
    });

    it('clamps clock skew to JUST NOW', () => {
        expect(relativeTimeLabel(2000, 1000)).toBe('JUST NOW');
    });
});
