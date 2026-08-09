import { describe, it, expect } from 'vitest';
import {
    byRecency,
    createSketch,
    duplicateName,
    languageCounts,
    relativeTimeLabel,
    type Sketch,
} from '~/utils/sketch/model';
import { SKETCH_STARTERS } from '~/utils/sketch/starters';

const at = (updatedAt: number): Sketch => ({ ...createSketch({ id: `s${updatedAt}`, now: 0 }), updatedAt });

describe('sketch model', () => {
    it('byRecency sorts most recently touched first without mutating', () => {
        const input = [at(1), at(3), at(2)];
        const sorted = byRecency(input);
        expect(sorted.map((s) => s.updatedAt)).toEqual([3, 2, 1]);
        expect(input.map((s) => s.updatedAt)).toEqual([1, 3, 2]);
    });

    it('languageCounts tallies per language', () => {
        const js = createSketch({ id: 'a', now: 0 });
        const tex = createSketch({ id: 'b', now: 0, language: 'tex' });
        expect(languageCounts([js, js, tex])).toEqual({ js: 2, tex: 1 });
        expect(languageCounts([])).toEqual({});
    });

    it('duplicateName finds the first free copy label', () => {
        expect(duplicateName('a', [])).toBe('a copy');
        expect(duplicateName('a', ['a copy'])).toBe('a copy 2');
        expect(duplicateName('a', ['a copy', 'a copy 2'])).toBe('a copy 3');
    });

    it('relativeTimeLabel steps through the ranges', () => {
        const m = 60_000;
        expect(relativeTimeLabel(0, 30_000)).toBe('JUST NOW');
        expect(relativeTimeLabel(0, 2 * m)).toBe('2M AGO');
        expect(relativeTimeLabel(0, 3 * 60 * m)).toBe('3H AGO');
        expect(relativeTimeLabel(0, 30 * 60 * m)).toBe('YESTERDAY');
        expect(relativeTimeLabel(0, 3 * 24 * 60 * m)).toBe('3D AGO');
        expect(relativeTimeLabel(0, 8 * 24 * 60 * m)).toBe('1W AGO');
        // clock skew (then in the future) clamps instead of going negative
        expect(relativeTimeLabel(5_000, 0)).toBe('JUST NOW');
    });
});

describe('sketch starters', () => {
    it('every starter seeds a valid sketch in its own language', () => {
        for (const starter of SKETCH_STARTERS) {
            const sketch = createSketch({ id: 'x', now: 1, ...starter.seed });
            expect(sketch.language).toBe(starter.language);
            expect(sketch.name).not.toBe('untitled');
        }
    });

    it('the tex starter seeds the maths tab, js starters seed code', () => {
        for (const starter of SKETCH_STARTERS) {
            const sketch = createSketch({ id: 'x', now: 1, ...starter.seed });
            const filled = starter.language === 'tex' ? sketch.tabs.maths : sketch.tabs.code;
            expect(filled.length).toBeGreaterThan(0);
        }
    });
});
