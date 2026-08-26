import { describe, it, expect } from 'vitest';
import {
    angleFor,
    arcLength,
    arcPath,
    dashArray,
    dragTo,
    polar,
    tickMarks,
    tToValue,
    valueToT,
    KNOB_DEFAULT_SWEEP,
    KNOB_DRAG_SPAN,
} from '~/utils/sketch/knob-geometry';

const FREQ = { min: 20, max: 3000, taper: 'log' as const };
const AMP = { min: 0, max: 1, taper: 'linear' as const };

describe('polar', () => {
    it('puts 0 degrees at twelve o-clock and turns clockwise', () => {
        const [ux, uy] = polar(0, 42);
        expect(ux).toBeCloseTo(50, 6);
        expect(uy).toBeCloseTo(8, 6);
        const [rx, ry] = polar(90, 42);
        expect(rx).toBeCloseTo(92, 6);
        expect(ry).toBeCloseTo(50, 6);
    });
});

/* Acceptance check 1. */
describe('indicator extremes', () => {
    it('sits bottom-left at min and bottom-right at max', () => {
        expect(angleFor(0)).toBe(-135);
        expect(angleFor(1)).toBe(135);
        const [lx, ly] = polar(angleFor(0), 42);
        const [rx, ry] = polar(angleFor(1), 42);
        expect(lx).toBeLessThan(50);
        expect(rx).toBeGreaterThan(50);
        expect(ly).toBeGreaterThan(50);
        expect(ry).toBeGreaterThan(50);
    });

    it('puts the centre tick at twelve o-clock at the default sweep', () => {
        const centre = tickMarks()[5]!;
        expect(centre.x1).toBeCloseTo(50, 6);
        expect(centre.y1).toBeLessThan(50);
        expect(centre.long).toBe(true);
    });

    it('engraves 11 marks, long at both ends and centre', () => {
        const ticks = tickMarks();
        expect(ticks).toHaveLength(11);
        expect(ticks.filter((t) => t.long).map((_, i) => i)).toHaveLength(3);
        expect([ticks[0]!.long, ticks[5]!.long, ticks[10]!.long]).toEqual([true, true, true]);
        expect(ticks[1]!.long).toBe(false);
    });
});

/* Acceptance check 2 - the arc and the indicator share t by construction. */
describe('arc and indicator agree', () => {
    it('lights a fraction of the arc equal to the fraction of the sweep turned', () => {
        const total = arcLength();
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const lit = Number(dashArray(t).split(' ')[0]);
            const turned = (angleFor(t) - angleFor(0)) / KNOB_DEFAULT_SWEEP;
            expect(lit / total).toBeCloseTo(turned, 10);
        }
    });

    it('measures 197.92 of arc at the default sweep', () => {
        expect(arcLength()).toBeCloseTo(197.92, 2);
    });

    it('draws the large-arc flag only past a half turn', () => {
        expect(arcPath(270)).toContain('A 42 42 0 1 1');
        expect(arcPath(170)).toContain('A 42 42 0 0 1');
    });
});

describe('taper', () => {
    it('linear maps the midpoint to the arithmetic middle', () => {
        expect(tToValue(0.5, AMP)).toBeCloseTo(0.5, 10);
        expect(valueToT(0.5, AMP)).toBeCloseTo(0.5, 10);
    });

    it('log maps the midpoint to the geometric middle', () => {
        /* sqrt(20 * 3000) = 245, not 1510 */
        expect(tToValue(0.5, FREQ)).toBeCloseTo(Math.sqrt(20 * 3000), 6);
    });

    it('log gives equal rotation to equal musical intervals', () => {
        const octaveUp = (v: number) => valueToT(v * 2, FREQ) - valueToT(v, FREQ);
        /* an octave costs the same fraction of travel anywhere in range */
        expect(octaveUp(40)).toBeCloseTo(octaveUp(400), 10);
        expect(octaveUp(100)).toBeCloseTo(octaveUp(1000), 10);
    });

    it('round-trips a value through t and back', () => {
        for (const v of [20, 55, 440, 1200, 3000]) {
            expect(tToValue(valueToT(v, FREQ), FREQ)).toBeCloseTo(v, 6);
        }
    });

    it('pins the ends exactly', () => {
        expect(valueToT(20, FREQ)).toBe(0);
        expect(valueToT(3000, FREQ)).toBe(1);
        expect(tToValue(0, FREQ)).toBeCloseTo(20, 10);
        expect(tToValue(1, FREQ)).toBeCloseTo(3000, 10);
    });

    it('falls back to linear rather than NaN when a log range touches zero', () => {
        const bad = { min: 0, max: 100, taper: 'log' as const };
        expect(tToValue(0.5, bad)).toBeCloseTo(50, 10);
        expect(Number.isFinite(valueToT(50, bad))).toBe(true);
    });

    it('clamps out-of-range values instead of running off the arc', () => {
        expect(valueToT(-5, AMP)).toBe(0);
        expect(valueToT(99, AMP)).toBe(1);
    });

    it('quantises to step when one is given', () => {
        const stepped = { min: 0, max: 10, step: 0.5 };
        expect(tToValue(0.31, stepped)).toBe(3);
        expect(tToValue(0.34, stepped)).toBe(3.5);
    });
});

/* Acceptance check 3. */
describe('drag', () => {
    const anchor = { startY: 300, startT: 0, fine: false };

    it('traverses the full range over the drag span, bottom to top', () => {
        const { t } = dragTo(anchor, 300 - KNOB_DRAG_SPAN, false);
        expect(t).toBe(1);
    });

    it('moves about a quarter as far with shift held', () => {
        const coarse = dragTo({ ...anchor, startT: 0.5 }, 200, false).t - 0.5;
        const fine = dragTo({ ...anchor, startT: 0.5, fine: true }, 200, true).t - 0.5;
        expect(fine / coarse).toBeCloseTo(220 / 900, 6);
    });

    it('recomputes from the anchor, so repeated moves do not accumulate', () => {
        const a = dragTo(anchor, 250, false).t;
        dragTo(anchor, 250, false);
        dragTo(anchor, 250, false);
        expect(dragTo(anchor, 250, false).t).toBe(a);
    });

    it('does not jump the value when shift is released mid-drag', () => {
        /* 100px of fine drag, then let go of shift and hold still */
        const fineAnchor = { startY: 300, startT: 0.4, fine: true };
        const held = dragTo(fineAnchor, 200, true);
        const released = dragTo(held.anchor, 200, false);
        expect(released.t).toBeCloseTo(held.t, 10);
        /* and the anchor has moved to here, so the next move is coarse */
        expect(released.anchor.fine).toBe(false);
        expect(released.anchor.startY).toBe(200);
    });

    it('re-anchors when shift is pressed mid-drag too', () => {
        const coarse = { startY: 300, startT: 0.2, fine: false };
        const moved = dragTo(coarse, 250, false);
        const engaged = dragTo(moved.anchor, 250, true);
        expect(engaged.t).toBeCloseTo(moved.t, 10);
        expect(engaged.anchor.fine).toBe(true);
    });

    it('clamps at both ends', () => {
        expect(dragTo(anchor, -5000, false).t).toBe(1);
        expect(dragTo({ ...anchor, startT: 1 }, 5000, false).t).toBe(0);
    });
});
