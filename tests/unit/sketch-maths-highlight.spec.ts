// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { highlightVariables, MATHS_VAR_COLOURS } from '~/utils/sketch/maths-highlight';

const SINUSOID = `x[n] = A \\cos(\\omega n T + \\phi) = A \\cos(2 \\pi f n T + \\phi)
\\qquad
T = \\frac{1}{f_s}
\\\\[1ex]
A = 0.4, \\qquad f = 220, \\qquad \\phi = 0`;

function render(tex: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = katex.renderToString(tex, { displayMode: true, throwOnError: false });
    highlightVariables(host);
    return host;
}

/* Coloured symbols in document order, as [symbol, colour] pairs. KaTeX
   pads its vlist rows with zero-width spacers - strip them the same way
   the module does so `f_s` reads as "fs". */
function coloured(host: HTMLElement): [string, string][] {
    return [...host.querySelectorAll('.sketch-var')].map((el) => [
        (el.textContent ?? '').replace(/[\s\u200b-\u200d\ufeff]+/g, ''),
        (el as HTMLElement).style.getPropertyValue('--sketch-var'),
    ]);
}

describe('highlightVariables', () => {
    it('gives each distinct symbol its own colour, in order of first appearance', () => {
        const found = coloured(render('x = A \\omega T'));
        expect(found.map(([symbol]) => symbol)).toEqual(['x', 'A', 'ω', 'T']);
        expect(found.map(([, colour]) => colour)).toEqual(MATHS_VAR_COLOURS.slice(0, 4));
    });

    it('reuses one colour for every occurrence of the same symbol', () => {
        const bySymbol = new Map(coloured(render(SINUSOID)));
        const occurrences = coloured(render(SINUSOID)).filter(([symbol]) => symbol === 'A');
        expect(occurrences.length).toBeGreaterThan(1);
        for (const [, colour] of occurrences) expect(colour).toBe(bySymbol.get('A'));
    });

    it('never hands the same colour to two different symbols', () => {
        const bySymbol = new Map(coloured(render(SINUSOID)));
        const colours = [...bySymbol.values()];
        /* This equation has more symbols than the palette has colours, so
           uniqueness only holds for the first MATHS_VAR_COLOURS.length. */
        const distinct = colours.slice(0, MATHS_VAR_COLOURS.length);
        expect(new Set(distinct).size).toBe(distinct.length);
    });

    it('colours a subscripted symbol as one unit, distinct from its base', () => {
        const bySymbol = new Map(coloured(render('f = 220 \\qquad f_s = 48000')));
        expect(bySymbol.has('fs')).toBe(true);
        expect(bySymbol.get('fs')).not.toBe(bySymbol.get('f'));
        /* the subscript is not coloured on its own */
        expect(bySymbol.has('s')).toBe(false);
    });

    it('leaves constants and digits alone', () => {
        const symbols = coloured(render('C = 2 \\pi r')).map(([symbol]) => symbol);
        expect(symbols).toEqual(['C', 'r']);
    });

    it('is idempotent - a second pass keeps the same colours', () => {
        const host = render(SINUSOID);
        const first = coloured(host);
        highlightVariables(host);
        expect(coloured(host)).toEqual(first);
    });
});
