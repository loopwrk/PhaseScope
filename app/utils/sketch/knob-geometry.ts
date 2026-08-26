/* Rotary knob geometry and value mapping (KNOB.md sections 2, 3 and 5).

   Everything here is pure so the acceptance checks in section 8 can be
   asserted numerically rather than squinted at: the arc and the indicator
   both derive from the same `t`, so they cannot drift apart. */

/* The 100x100 user space the SVG is drawn in. */
export const KNOB_CENTRE = 50;
export const KNOB_ARC_RADIUS = 42;
export const KNOB_DEFAULT_SWEEP = 270;
/* Pixels of vertical travel for the full range; shift is the fine gear. */
export const KNOB_DRAG_SPAN = 220;
export const KNOB_FINE_DRAG_SPAN = 900;

export type KnobTaper = 'linear' | 'log';

export interface KnobRange {
    min: number;
    max: number;
    taper?: KnobTaper;
    step?: number;
}

/* 0 degrees points up, positive clockwise. */
export function polar(deg: number, r: number): [number, number] {
    const rad = (deg * Math.PI) / 180;
    return [KNOB_CENTRE + r * Math.sin(rad), KNOB_CENTRE - r * Math.cos(rad)];
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* A log taper needs a positive floor to take the ratio against; a range
   that crosses or touches zero silently falls back to linear rather than
   producing NaN for every position. */
function usesLog(range: KnobRange): boolean {
    return range.taper === 'log' && range.min > 0 && range.max > 0;
}

export function valueToT(value: number, range: KnobRange): number {
    const { min, max } = range;
    if (!Number.isFinite(value) || max === min) return 0;
    const t = usesLog(range)
        ? Math.log(Math.max(value, min) / min) / Math.log(max / min)
        : (value - min) / (max - min);
    return clamp01(t);
}

export function tToValue(t: number, range: KnobRange): number {
    const { min, max, step } = range;
    const raw = usesLog(range) ? min * (max / min) ** clamp01(t) : min + (max - min) * clamp01(t);
    if (!step || step <= 0) return raw;
    /* Quantise against min so the steps land where the caller expects. */
    const snapped = min + Math.round((raw - min) / step) * step;
    const decimals = Math.max(0, Math.ceil(-Math.log10(step)) + 1);
    return Number(Math.min(max, Math.max(min, snapped)).toFixed(Math.min(20, decimals)));
}

export function angleFor(t: number, sweep = KNOB_DEFAULT_SWEEP): number {
    return -sweep / 2 + clamp01(t) * sweep;
}

/* The single arc both the track and the value path are drawn along. */
export function arcPath(sweep = KNOB_DEFAULT_SWEEP, radius = KNOB_ARC_RADIUS): string {
    const half = sweep / 2;
    const [sx, sy] = polar(-half, radius);
    const [ex, ey] = polar(half, radius);
    return `M${sx} ${sy} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${ex} ${ey}`;
}

export function arcLength(sweep = KNOB_DEFAULT_SWEEP, radius = KNOB_ARC_RADIUS): number {
    return 2 * Math.PI * radius * (sweep / 360);
}

/* `+ 2` on the gap so the remainder cannot wrap round and paint a sliver
   back at the start of the arc. */
export function dashArray(t: number, sweep = KNOB_DEFAULT_SWEEP, radius = KNOB_ARC_RADIUS): string {
    const total = arcLength(sweep, radius);
    const lit = total * clamp01(t);
    return `${lit} ${total - lit + 2}`;
}

export interface KnobTick {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    long: boolean;
}

/* 11 engraved marks, longer at both ends and at centre. Static: they are a
   rotation reference, not a value scale - which is what lets frequency
   take a log taper without the face lying (the readout carries the value). */
export function tickMarks(sweep = KNOB_DEFAULT_SWEEP): KnobTick[] {
    const half = sweep / 2;
    return Array.from({ length: 11 }, (_, i) => {
        const angle = -half + (sweep * i) / 10;
        const long = i === 0 || i === 5 || i === 10;
        const [x1, y1] = polar(angle, long ? 32 : 35);
        const [x2, y2] = polar(angle, 40);
        return { x1, y1, x2, y2, long };
    });
}

export interface DragAnchor {
    startY: number;
    startT: number;
    fine: boolean;
}

/* Recomputed from the anchor every move rather than accumulated, so a
   drag cannot drift. Changing the shift key re-anchors at the current
   position first: without that, swapping the span mid-drag would snap the
   value (acceptance check 3). */
export function dragTo(anchor: DragAnchor, clientY: number, fine: boolean): { t: number; anchor: DragAnchor } {
    const span = anchor.fine ? KNOB_FINE_DRAG_SPAN : KNOB_DRAG_SPAN;
    const t = clamp01(anchor.startT + (anchor.startY - clientY) / span);
    if (fine === anchor.fine) return { t, anchor };
    return { t, anchor: { startY: clientY, startT: t, fine } };
}
