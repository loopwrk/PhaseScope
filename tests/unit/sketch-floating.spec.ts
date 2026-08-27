import { describe, it, expect } from 'vitest';
import {
    clampToViewport,
    dragOrigin,
    moveTo,
    movedBeyond,
    FLOAT_MARGIN,
    nudge,
    nudgeDelta,
    readPlacements,
    NUDGE_FINE_PX,
    NUDGE_PX,
    UNDOCK_THRESHOLD_PX,
} from '~/utils/sketch/floating';

const CARD = { width: 200, height: 160 };
const SCREEN = { width: 1000, height: 800 };

describe('clampToViewport', () => {
    it('leaves a position that is already on screen alone', () => {
        expect(clampToViewport({ x: 300, y: 200 }, CARD, SCREEN)).toEqual({ x: 300, y: 200 });
    });

    it('holds the card inside every edge', () => {
        expect(clampToViewport({ x: -500, y: 200 }, CARD, SCREEN).x).toBe(FLOAT_MARGIN);
        expect(clampToViewport({ x: 300, y: -500 }, CARD, SCREEN).y).toBe(FLOAT_MARGIN);
        expect(clampToViewport({ x: 9999, y: 200 }, CARD, SCREEN).x).toBe(1000 - 200 - FLOAT_MARGIN);
        expect(clampToViewport({ x: 300, y: 9999 }, CARD, SCREEN).y).toBe(800 - 160 - FLOAT_MARGIN);
    });

    it('keeps the whole card visible, not just its corner', () => {
        const { x, y } = clampToViewport({ x: 9999, y: 9999 }, CARD, SCREEN);
        expect(x + CARD.width).toBeLessThanOrEqual(SCREEN.width);
        expect(y + CARD.height).toBeLessThanOrEqual(SCREEN.height);
    });

    it('pins a card bigger than the window to the corner rather than inverting', () => {
        const huge = { width: 2000, height: 2000 };
        expect(clampToViewport({ x: 400, y: 400 }, huge, SCREEN)).toEqual({ x: FLOAT_MARGIN, y: FLOAT_MARGIN });
    });
});

describe('dragOrigin', () => {
    it('records where in the card the pointer grabbed', () => {
        expect(dragOrigin({ x: 320, y: 260 }, { x: 300, y: 200 })).toEqual({ x: 20, y: 60 });
    });
});

describe('moveTo', () => {
    it('keeps the grab point under the pointer', () => {
        const position = { x: 300, y: 200 };
        const origin = dragOrigin({ x: 320, y: 260 }, position);
        expect(moveTo({ x: 500, y: 400 }, origin, CARD, SCREEN)).toEqual({ x: 480, y: 340 });
    });

    it('does not jump the corner to the cursor on the first move', () => {
        const position = { x: 300, y: 200 };
        const origin = dragOrigin({ x: 380, y: 300 }, position);
        expect(moveTo({ x: 380, y: 300 }, origin, CARD, SCREEN)).toEqual(position);
    });

    it('recomputes from the origin, so repeats do not accumulate', () => {
        const origin = dragOrigin({ x: 320, y: 260 }, { x: 300, y: 200 });
        const once = moveTo({ x: 500, y: 400 }, origin, CARD, SCREEN);
        moveTo({ x: 500, y: 400 }, origin, CARD, SCREEN);
        expect(moveTo({ x: 500, y: 400 }, origin, CARD, SCREEN)).toEqual(once);
    });

    it('clamps while dragging, so a card cannot be thrown off screen', () => {
        const origin = dragOrigin({ x: 320, y: 260 }, { x: 300, y: 200 });
        expect(moveTo({ x: 5000, y: 5000 }, origin, CARD, SCREEN)).toEqual({
            x: SCREEN.width - CARD.width - FLOAT_MARGIN,
            y: SCREEN.height - CARD.height - FLOAT_MARGIN,
        });
    });
});

describe('movedBeyond', () => {
    it('ignores a press that barely moves, so a click is not an undock', () => {
        expect(movedBeyond({ x: 100, y: 100 }, { x: 101, y: 101 })).toBe(false);
    });

    it('trips once the grip has actually travelled', () => {
        expect(movedBeyond({ x: 100, y: 100 }, { x: 100, y: 100 + UNDOCK_THRESHOLD_PX })).toBe(true);
    });

    it('measures distance, not one axis', () => {
        /* 3,3 is 4.24 away - diagonal drags should undock too */
        expect(movedBeyond({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(true);
        expect(movedBeyond({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(false);
    });
});

describe('readPlacements', () => {
    it('keeps well-formed entries', () => {
        expect(readPlacements({ f: { x: 100, y: 200 } })).toEqual({ f: { x: 100, y: 200 } });
    });

    it('drops anything that is not a finite point', () => {
        expect(
            readPlacements({
                good: { x: 1, y: 2 },
                nan: { x: Number.NaN, y: 2 },
                infinite: { x: 1, y: Infinity },
                missing: { x: 1 },
                stringy: { x: '1', y: '2' },
                nulled: null,
                primitive: 7,
            })
        ).toEqual({ good: { x: 1, y: 2 } });
    });

    it('survives storage returning something else entirely', () => {
        for (const junk of [null, undefined, 'nope', 42, [1, 2, 3]]) {
            expect(readPlacements(junk)).toEqual({});
        }
    });

    it('takes only x and y, not whatever else was stored alongside', () => {
        expect(readPlacements({ f: { x: 1, y: 2, z: 9, evil: true } })).toEqual({ f: { x: 1, y: 2 } });
    });
});

describe('nudgeDelta', () => {
    it('maps each arrow to a step in screen coordinates', () => {
        expect(nudgeDelta('ArrowUp')).toEqual({ x: 0, y: -NUDGE_PX });
        expect(nudgeDelta('ArrowDown')).toEqual({ x: 0, y: NUDGE_PX });
        expect(nudgeDelta('ArrowLeft')).toEqual({ x: -NUDGE_PX, y: 0 });
        expect(nudgeDelta('ArrowRight')).toEqual({ x: NUDGE_PX, y: 0 });
    });

    it('takes the fine gear on shift, like the knob does', () => {
        expect(nudgeDelta('ArrowUp', true)).toEqual({ x: 0, y: -NUDGE_FINE_PX });
    });

    it('ignores keys that are not arrows', () => {
        for (const key of ['Enter', 'a', 'Tab', 'PageUp', ' ']) expect(nudgeDelta(key)).toBeNull();
    });
});

describe('nudge', () => {
    it('moves by the delta', () => {
        expect(nudge({ x: 100, y: 100 }, { x: 0, y: -NUDGE_PX }, CARD, SCREEN)).toEqual({ x: 100, y: 100 - NUDGE_PX });
    });

    it('cannot walk a card off the screen one key at a time', () => {
        let position = { x: 100, y: 100 };
        for (let i = 0; i < 500; i++) position = nudge(position, { x: -NUDGE_PX, y: -NUDGE_PX }, CARD, SCREEN);
        expect(position).toEqual({ x: FLOAT_MARGIN, y: FLOAT_MARGIN });
    });

    it('clamps at the far edges too', () => {
        let position = { x: 100, y: 100 };
        for (let i = 0; i < 500; i++) position = nudge(position, { x: NUDGE_PX, y: NUDGE_PX }, CARD, SCREEN);
        expect(position).toEqual({
            x: SCREEN.width - CARD.width - FLOAT_MARGIN,
            y: SCREEN.height - CARD.height - FLOAT_MARGIN,
        });
    });
});
