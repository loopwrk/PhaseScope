/* Sketch data model.

   Everything stateful (reactivity, storage, ids, clocks) lives in
   useSketchStore; this module stays pure so the naming, ordering and
   time-label rules are unit-testable without a Nuxt runtime. */

export type SketchLanguage = 'js' | 'tex';
export type SketchAspect = 'fit' | '16:9' | '1:1' | 'free';

export interface SketchTabs {
    code: string;
    maths: string;
    notes: string;
}

export interface Sketch {
    id: string;
    name: string;
    language: SketchLanguage;
    tabs: SketchTabs;
    aspect: SketchAspect;
    /* Width / height the canvas letterboxes to in FIT mode. */
    preferredRatio: number;
    /* Data-URL PNG of the last rendered frame; the library card thumbnail. */
    thumbnail: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface SketchSeed {
    id: string;
    now: number;
    name?: string;
    language?: SketchLanguage;
    tabs?: Partial<SketchTabs>;
}

export function createSketch({ id, now, name = 'untitled', language = 'js', tabs }: SketchSeed): Sketch {
    return {
        id,
        name,
        language,
        tabs: { code: '', maths: '', notes: '', ...tabs },
        aspect: 'fit',
        preferredRatio: 16 / 9,
        thumbnail: null,
        createdAt: now,
        updatedAt: now,
    };
}

/* "name copy", then "name copy 2", "name copy 3", ... - first label not
   already taken. */
export function duplicateName(name: string, taken: readonly string[]): string {
    const takenSet = new Set(taken);
    const base = `${name} copy`;
    if (!takenSet.has(base)) return base;
    let n = 2;
    while (takenSet.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
}

/* Most recently touched first. Returns a copy - callers sort persisted
   state without reordering it. */
export function byRecency(sketches: readonly Sketch[]): Sketch[] {
    return [...sketches].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function languageCounts(sketches: readonly Sketch[]): Partial<Record<SketchLanguage, number>> {
    const counts: Partial<Record<SketchLanguage, number>> = {};
    for (const { language } of sketches) counts[language] = (counts[language] ?? 0) + 1;
    return counts;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTimeLabel(then: number, now: number): string {
    const elapsed = Math.max(0, now - then);
    if (elapsed < MINUTE) return 'JUST NOW';
    if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}M AGO`;
    if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}H AGO`;
    if (elapsed < 2 * DAY) return 'YESTERDAY';
    if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}D AGO`;
    if (elapsed < 30 * DAY) return `${Math.floor(elapsed / (7 * DAY))}W AGO`;
    if (elapsed < 365 * DAY) return `${Math.floor(elapsed / (30 * DAY))}MO AGO`;
    return `${Math.floor(elapsed / (365 * DAY))}Y AGO`;
}
