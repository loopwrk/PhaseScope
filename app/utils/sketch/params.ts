/* Maths-tab parameters. The maths TeX is the source of truth: any
   simple assignment in it - `f = 220`, `\phi = 0`, `f_s = 48000` -
   becomes a runner parameter and a field in the params bar. Only a
   bare numeric right-hand side counts, so equation lines like
   `x[n] = A \cos(...)` or `T = \frac{1}{f_s}` are left alone. */

export interface SketchParam {
    /* JS-safe name the code destructures: `\phi` -> phi, `f_{s}` -> fs. */
    name: string;
    /* Label glyph for the params bar: phi -> φ. */
    display: string;
    value: number;
}

const GREEK: Record<string, string> = {
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    delta: 'δ',
    epsilon: 'ε',
    theta: 'θ',
    lambda: 'λ',
    mu: 'μ',
    pi: 'π',
    sigma: 'σ',
    tau: 'τ',
    phi: 'φ',
    psi: 'ψ',
    omega: 'ω',
};

/* The reverse trip: a glyph read back out of the rendered equation, folded
   to the name a parameter goes by. Needed because KaTeX and the params bar
   do not always spell the same letter with the same code point - \phi
   renders as U+03D5 in the equation but the label uses U+03C6 - so
   matching a rendered symbol to a parameter has to go through here rather
   than comparing strings. */
const NAME_BY_GLYPH: Record<string, string> = Object.fromEntries(
    Object.entries(GREEK).map(([name, glyph]) => [glyph, name])
);
/* KaTeX's variant code points for letters GREEK already covers. */
const VARIANT_GLYPHS: Record<string, string> = {
    '\u03d5': 'phi',
    '\u03d1': 'theta',
    '\u03f5': 'epsilon',
    '\u03d6': 'pi',
};

export function nameForGlyph(glyph: string): string {
    const [base = '', ...subscript] = [...glyph];
    return (VARIANT_GLYPHS[base] ?? NAME_BY_GLYPH[base] ?? base) + subscript.join('');
}

/* symbol [= number] where symbol is a latin/greek identifier with an
   optional subscript, and the number ends the value (no trailing
   expression). */
const ASSIGNMENT = /(\\?[A-Za-z]+(?:_(?:\{[A-Za-z0-9]+\}|[A-Za-z0-9]))?)\s*=\s*(-?(?:\d+\.?\d*|\.\d+))(?![\d.])/g;

function toName(symbol: string): string {
    return symbol.replace(/[\\{}_]/g, '');
}

function toDisplay(symbol: string): string {
    const [base = '', sub = ''] = symbol.replace(/^\\/, '').replace(/[{}]/g, '').split('_');
    return (GREEK[base] ?? base) + sub;
}

interface Located extends SketchParam {
    valueStart: number;
    valueEnd: number;
}

function locate(tex: string): Located[] {
    const seen = new Set<string>();
    const found: Located[] = [];
    for (const match of tex.matchAll(ASSIGNMENT)) {
        const [, symbol = '', literal = ''] = match;
        const name = toName(symbol);
        if (seen.has(name)) continue;
        seen.add(name);
        const valueStart = match.index + match[0].lastIndexOf(literal);
        found.push({
            name,
            display: toDisplay(symbol),
            value: Number(literal),
            valueStart,
            valueEnd: valueStart + literal.length,
        });
    }
    return found;
}

export function extractParams(tex: string): SketchParam[] {
    return locate(tex).map(({ name, display, value }) => ({ name, display, value }));
}

export function extractParamRecord(tex: string): Record<string, number> {
    return Object.fromEntries(extractParams(tex).map((p) => [p.name, p.value]));
}

/* Rewrite one assignment's numeric literal in place; unknown names
   leave the text untouched. */
export function setParamValue(tex: string, name: string, value: number): string {
    const target = locate(tex).find((p) => p.name === name);
    if (!target || !Number.isFinite(value)) return tex;
    return tex.slice(0, target.valueStart) + String(value) + tex.slice(target.valueEnd);
}

/* Wrap each assignment's numeric literal in \htmlId so the rendered
   equation carries an addressable slot per param - that is where the
   preview mounts its inline input. Rewritten back-to-front so earlier
   offsets stay valid as the string grows. */
export function tagParamValues(tex: string, idPrefix: string): string {
    let tagged = tex;
    for (const param of [...locate(tex)].reverse()) {
        const literal = tex.slice(param.valueStart, param.valueEnd);
        tagged =
            tagged.slice(0, param.valueStart) +
            `\\htmlId{${paramValueId(idPrefix, param.name)}}{${literal}}` +
            tagged.slice(param.valueEnd);
    }
    return tagged;
}

/* Shared by the tagger and whatever goes looking for the slot. */
export function paramValueId(idPrefix: string, name: string): string {
    return `${idPrefix}-param-${name}`;
}
