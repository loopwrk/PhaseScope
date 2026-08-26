/* Variable colouring for the equation above the canvas.

   KaTeX marks every italic maths identifier with `.mord.mathnormal`, so
   the symbols can be picked out of the rendered output without parsing
   TeX a second time. Each distinct symbol is set in its own colour,
   handed out in order of first appearance and stable across re-renders
   of the same equation - so `A` reads the same in `A cos(...)` as it
   does in `A = 0.4`, and the eye can trace one variable through the
   whole block.

   Applied to rendered DOM rather than baked into the HTML string: the
   server-rendered markup stays plain KaTeX, and the client enhances it
   after hydration with no mismatch. */

/* The palette tokens, in the order they are assigned. */
export const MATHS_VAR_COLOURS: readonly string[] = [
    'var(--sketch-var-1)',
    'var(--sketch-var-2)',
    'var(--sketch-var-3)',
    'var(--sketch-var-4)',
    'var(--sketch-var-5)',
    'var(--sketch-var-6)',
    'var(--sketch-var-7)',
];

/* Symbols that are constants, not variables - never coloured. */
const CONSTANTS = new Set(['π', 'e', '∞']);

/* `f_s` renders as a wrapper .mord holding the base glyph plus a
   .msupsub; colouring the wrapper takes the base and its subscript
   together, and keeps `f_s` distinct from a plain `f`. */
function colourTarget(glyph: Element): Element {
    const parent = glyph.parentElement;
    if (!parent || !parent.classList.contains('mord') || parent.classList.contains('mathnormal')) return glyph;
    if (parent.firstElementChild !== glyph) return glyph;
    const hasSubSup = [...parent.children].some((child) => child.classList.contains('msupsub'));
    return hasSubSup ? parent : glyph;
}

/* True once any ancestor up to `root` has already been coloured - that
   is how the `s` of `f_s` is skipped after its wrapper was claimed. */
function insideColoured(glyph: Element, root: Element, claimed: ReadonlySet<Element>): boolean {
    for (let el = glyph.parentElement; el && el !== root; el = el.parentElement) {
        if (claimed.has(el)) return true;
    }
    return false;
}

/* Whitespace inside KaTeX markup is layout, not content - and its
   vlist rows carry zero-width spacers that would otherwise land in the
   key and stop `f_s` matching itself between renders. */
function symbolKey(el: Element): string {
    return (el.textContent ?? '').replace(/[\s\u200b-\u200d\ufeff]+/g, '');
}

/* Adds .sketch-var + a --sketch-var colour to each variable in `root`,
   and returns the symbol -> colour map it settled on, so a control tinted
   to match a variable reads the same colour the equation gave it.
   Idempotent: re-running on the same tree reassigns the same colours. */
export function highlightVariables(root: Element): Map<string, string> {
    const colourBySymbol = new Map<string, string>();
    const claimed = new Set<Element>();

    for (const glyph of root.querySelectorAll('.mord.mathnormal')) {
        if (insideColoured(glyph, root, claimed)) continue;
        const target = colourTarget(glyph);
        if (claimed.has(target)) continue;

        const key = symbolKey(target);
        if (!key || CONSTANTS.has(key)) continue;
        claimed.add(target);

        /* More symbols than colours cycles rather than repeating the
           last one - still stable, still legible side by side. */
        const colour =
            colourBySymbol.get(key) ?? MATHS_VAR_COLOURS[colourBySymbol.size % MATHS_VAR_COLOURS.length]!;
        colourBySymbol.set(key, colour);

        target.classList.add('sketch-var');
        (target as HTMLElement).style.setProperty('--sketch-var', colour);
    }

    return colourBySymbol;
}
