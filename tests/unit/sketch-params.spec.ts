import { describe, it, expect } from 'vitest';
import {
    extractParamRecord,
    extractParams,
    nameForGlyph,
    paramValueId,
    setParamValue,
    tagParamValues,
} from '~/utils/sketch/params';

const SINUSOID = `x[n] = A \\cos(\\omega n T + \\phi) = A \\cos(2 \\pi f n T + \\phi)
\\\\[1ex]
A = 0.4, \\qquad f = 220, \\qquad \\phi = 0`;

describe('extractParams', () => {
    it('finds latin and greek assignments with bare numeric values', () => {
        expect(extractParams(SINUSOID)).toEqual([
            { name: 'A', display: 'A', value: 0.4 },
            { name: 'f', display: 'f', value: 220 },
            { name: 'phi', display: 'φ', value: 0 },
        ]);
    });

    it('ignores equation lines and non-numeric right-hand sides', () => {
        const tex = 'x[n] = A \\cos(2 \\pi f n T) \\qquad T = \\frac{1}{f_s}';
        expect(extractParams(tex)).toEqual([]);
    });

    it('handles subscripts, negatives and decimals', () => {
        const params = extractParams('f_s = 48000, \\quad f_{c} = -3.5, \\quad g = .25');
        expect(params).toEqual([
            { name: 'fs', display: 'fs', value: 48000 },
            { name: 'fc', display: 'fc', value: -3.5 },
            { name: 'g', display: 'g', value: 0.25 },
        ]);
    });

    it('keeps the first occurrence of a duplicated symbol', () => {
        expect(extractParams('f = 220 \\quad f = 440')).toEqual([{ name: 'f', display: 'f', value: 220 }]);
    });

    it('extractParamRecord maps names to values', () => {
        expect(extractParamRecord(SINUSOID)).toEqual({ A: 0.4, f: 220, phi: 0 });
    });
});

describe('setParamValue', () => {
    it('rewrites only the numeric literal', () => {
        const updated = setParamValue(SINUSOID, 'f', 440);
        expect(updated).toContain('f = 440');
        expect(updated).toContain('A = 0.4');
        expect(extractParamRecord(updated).f).toBe(440);
    });

    it('round-trips through extract after a rewrite', () => {
        const updated = setParamValue(setParamValue(SINUSOID, 'phi', 1.57), 'A', 0.9);
        expect(extractParamRecord(updated)).toEqual({ A: 0.9, f: 220, phi: 1.57 });
    });

    it('leaves the text alone for unknown names or bad values', () => {
        expect(setParamValue(SINUSOID, 'nope', 1)).toBe(SINUSOID);
        expect(setParamValue(SINUSOID, 'f', Number.NaN)).toBe(SINUSOID);
    });
});

describe('tagParamValues', () => {
    it('wraps every assignment value in an addressable slot', () => {
        const tagged = tagParamValues('A = 0.4, \\qquad f = 220', 'v0');
        expect(tagged).toBe(`A = \\htmlId{${paramValueId('v0', 'A')}}{0.4}, \\qquad f = \\htmlId{${paramValueId('v0', 'f')}}{220}`);
    });

    it('leaves equation lines untouched', () => {
        const tex = 'x[n] = A \\cos(2 \\pi f n T) \\qquad T = \\frac{1}{f_s}';
        expect(tagParamValues(tex, 'v0')).toBe(tex);
    });

    it('keeps later offsets valid while the string grows', () => {
        const tagged = tagParamValues('a = 1, b = 2, c = 3', 'v0');
        expect(tagged).toContain(`{${paramValueId('v0', 'a')}}{1}`);
        expect(tagged).toContain(`{${paramValueId('v0', 'b')}}{2}`);
        expect(tagged).toContain(`{${paramValueId('v0', 'c')}}{3}`);
    });

    it('tags values the extractor would find, and no others', () => {
        const tex = 'f_s = 48000 \\quad g = -3.5';
        const tagged = tagParamValues(tex, 'v0');
        expect([...tagged.matchAll(/\\htmlId/g)]).toHaveLength(extractParams(tex).length);
    });
});

describe('nameForGlyph', () => {
    it('folds a greek glyph back to its parameter name', () => {
        expect(nameForGlyph('\u03c6')).toBe('phi');
        expect(nameForGlyph('\u03c9')).toBe('omega');
    });

    it("folds KaTeX's variant code points too - the reason this exists", () => {
        /* the equation renders \phi as U+03D5, the params bar uses U+03C6 */
        expect(nameForGlyph('\u03d5')).toBe('phi');
        expect(nameForGlyph('\u03d5')).toBe(nameForGlyph('\u03c6'));
    });

    it('leaves latin symbols alone', () => {
        expect(nameForGlyph('A')).toBe('A');
        expect(nameForGlyph('f')).toBe('f');
    });

    it('keeps a subscript attached', () => {
        expect(nameForGlyph('fs')).toBe('fs');
        expect(nameForGlyph('\u03c91')).toBe('omega1');
    });

    it('round-trips every symbol the params bar can display', () => {
        for (const param of extractParams('\\phi = 1, \\quad \\omega = 2, \\quad A = 3, \\quad f_s = 4')) {
            expect(nameForGlyph(param.display)).toBe(param.name);
        }
    });
});
