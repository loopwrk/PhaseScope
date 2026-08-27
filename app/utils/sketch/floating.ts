/* Position maths for a card lifted out of the layout.

   Same discipline as the knob drag: the pointer offset is captured once at
   pointerdown and every later move is computed from it, never accumulated,
   so a long drag cannot drift. Kept separate from the component so the
   clamping - the part that decides whether a card can be lost off-screen -
   is unit-tested rather than eyeballed. */

export interface Point {
    x: number;
    y: number;
}
export interface Size {
    width: number;
    height: number;
}

/* Breathing room kept between a floating card and the window edge. */
export const FLOAT_MARGIN = 8;
/* How far the grip must travel before a docked card lifts out. Without it
   every click on a label strip would undock the card. */
export const UNDOCK_THRESHOLD_PX = 4;

/* Holds the whole card on screen. A card larger than the window would give
   an inverted range, so the lower bound wins and it pins to the top-left
   corner instead of jumping somewhere impossible. */
export function clampToViewport(position: Point, size: Size, viewport: Size, margin = FLOAT_MARGIN): Point {
    const maxX = Math.max(margin, viewport.width - size.width - margin);
    const maxY = Math.max(margin, viewport.height - size.height - margin);
    return {
        x: Math.min(Math.max(margin, position.x), maxX),
        y: Math.min(Math.max(margin, position.y), maxY),
    };
}

/* Where the pointer sits inside the card, so the card does not jump its
   corner to the cursor on the first move. */
export function dragOrigin(pointer: Point, position: Point): Point {
    return { x: pointer.x - position.x, y: pointer.y - position.y };
}

export function moveTo(pointer: Point, origin: Point, size: Size, viewport: Size, margin = FLOAT_MARGIN): Point {
    return clampToViewport({ x: pointer.x - origin.x, y: pointer.y - origin.y }, size, viewport, margin);
}

/* Keyboard step for a floating card. Shift is the fine gear, matching the
   knob - consistency inside the app beats the 1px/10px convention outside
   it, and parking a panel wants the coarse step by default anyway. */
export const NUDGE_PX = 8;
export const NUDGE_FINE_PX = 1;

const ARROWS: Record<string, Point> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
};

/* The move a key asks for, or null if that key means nothing here. */
export function nudgeDelta(key: string, fine = false): Point | null {
    const direction = ARROWS[key];
    if (!direction) return null;
    const step = fine ? NUDGE_FINE_PX : NUDGE_PX;
    return { x: direction.x * step, y: direction.y * step };
}

export function nudge(position: Point, delta: Point, size: Size, viewport: Size, margin = FLOAT_MARGIN): Point {
    return clampToViewport({ x: position.x + delta.x, y: position.y + delta.y }, size, viewport, margin);
}

export function movedBeyond(from: Point, to: Point, threshold = UNDOCK_THRESHOLD_PX): boolean {
    return Math.hypot(to.x - from.x, to.y - from.y) >= threshold;
}

/* Storage can hand back anything: a shape from an older build, a
   hand-edited entry, half a write. Anything that is not a finite point is
   dropped rather than trusted - a NaN would park a card nowhere and there
   would be no way to get it back. */
export function readPlacements(stored: unknown): Record<string, Point> {
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    const out: Record<string, Point> = {};
    for (const [name, value] of Object.entries(stored as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') continue;
        const { x, y } = value as Partial<Point>;
        if (typeof x !== 'number' || typeof y !== 'number') continue;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        out[name] = { x, y };
    }
    return out;
}
