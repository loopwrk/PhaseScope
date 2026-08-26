// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest';
import {
    attachNumberScrub,
    scrubMultiplier,
    scrubStep,
    scrubbedValue,
    stepsFromDelta,
    SCRUB_PIXELS_PER_STEP,
    SCRUB_THRESHOLD_PX,
    SCRUB_KEY_HOLD_MS,
} from '~/utils/sketch/number-scrub';

describe('scrubStep', () => {
    it('is a tenth of the value\'s leading order', () => {
        expect(scrubStep(0.4)).toBeCloseTo(0.01, 10);
        expect(scrubStep(200)).toBe(10);
        expect(scrubStep(1024)).toBe(100);
        expect(scrubStep(48000)).toBe(1000);
    });

    it('is sign-agnostic', () => {
        expect(scrubStep(-200)).toBe(scrubStep(200));
    });

    it('falls back to a 0..1-friendly step where there is no magnitude to read', () => {
        expect(scrubStep(0)).toBe(0.01);
        expect(scrubStep(Number.NaN)).toBe(0.01);
    });
});

describe('stepsFromDelta', () => {
    it('treats up as an increase', () => {
        expect(stepsFromDelta(-SCRUB_PIXELS_PER_STEP * 3)).toBe(3);
        expect(stepsFromDelta(SCRUB_PIXELS_PER_STEP * 3)).toBe(-3);
    });

    it('ignores travel below one step', () => {
        expect(stepsFromDelta(1)).toBe(0);
    });
});

describe('scrubMultiplier', () => {
    it('coarsens with shift and refines with alt', () => {
        expect(scrubMultiplier({ shiftKey: true })).toBe(10);
        expect(scrubMultiplier({ altKey: true })).toBe(0.1);
        expect(scrubMultiplier({})).toBe(1);
    });
});

describe('scrubbedValue', () => {
    it('moves by whole steps from the starting value', () => {
        expect(scrubbedValue(200, 5)).toBe(250);
        expect(scrubbedValue(200, -5)).toBe(150);
    });

    it('applies the modifier multiplier', () => {
        /* shift gains a decade, alt drops one - so alt on a frequency is
           the units-of-one fine adjust */
        expect(scrubbedValue(200, 5, 10)).toBe(700);
        expect(scrubbedValue(200, 5, 0.1)).toBe(205);
    });

    it('never accumulates float noise', () => {
        expect(scrubbedValue(0.4, 3)).toBe(0.43);
        expect(scrubbedValue(0.1, 2)).toBe(0.12);
    });

    it('keeps precision the value was typed with, even under a coarse step', () => {
        /* step for 523.25 is 10 - the .25 must survive */
        expect(scrubbedValue(523.25, 3)).toBe(553.25);
    });

    it('steps a zero without dividing by its absent magnitude', () => {
        expect(scrubbedValue(0, 25)).toBe(0.25);
    });
});

/* happy-dom has no PointerEvent constructor; the listeners only read
   button / clientY / pointerId / modifier flags. */
function pointer(type: string, props: Record<string, unknown> = {}): Event {
    return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        button: 0,
        clientY: 0,
        pointerId: 1,
        ...props,
    });
}

function wire(startValue = 220) {
    const input = document.createElement('input');
    input.value = String(startValue);
    const write = vi.fn((value: number) => (input.value = String(value)));
    const onStart = vi.fn();
    const onEnd = vi.fn();
    attachNumberScrub(input, { read: () => Number(input.value), write, onStart, onEnd });
    return { input, write, onStart, onEnd };
}

describe('attachNumberScrub', () => {
    it('leaves a press that never moves alone, so click-to-type survives', () => {
        const { input, write, onStart } = wire();
        input.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
        input.dispatchEvent(pointer('pointermove', { clientY: 100 + SCRUB_THRESHOLD_PX - 1 }));
        input.dispatchEvent(pointer('pointerup', { clientY: 100 }));
        expect(write).not.toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled();
    });

    it('scrubs up once past the threshold', () => {
        const { input, write, onStart, onEnd } = wire(200);
        input.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
        input.dispatchEvent(pointer('pointermove', { clientY: 100 - SCRUB_PIXELS_PER_STEP * 4 }));
        expect(onStart).toHaveBeenCalledOnce();
        expect(write).toHaveBeenLastCalledWith(240);

        input.dispatchEvent(pointer('pointerup', { clientY: 100 }));
        expect(onEnd).toHaveBeenCalledOnce();
    });

    it('measures every step from where the drag began, not the last frame', () => {
        const { input, write } = wire(200);
        input.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
        input.dispatchEvent(pointer('pointermove', { clientY: 100 - SCRUB_PIXELS_PER_STEP * 2 }));
        input.dispatchEvent(pointer('pointermove', { clientY: 100 - SCRUB_PIXELS_PER_STEP * 5 }));
        /* not 200 + 20 + 50 */
        expect(write).toHaveBeenLastCalledWith(250);
    });

    it('holds the step size steady across a drag that changes magnitude', () => {
        const { input, write } = wire(0);
        input.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
        input.dispatchEvent(pointer('pointermove', { clientY: 100 - SCRUB_PIXELS_PER_STEP * 50 }));
        /* step stays the 0.01 taken at the start, so 50 steps is 0.5 */
        expect(write).toHaveBeenLastCalledWith(0.5);
    });

    it('drags down to decrease', () => {
        const { input, write } = wire(200);
        input.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
        input.dispatchEvent(pointer('pointermove', { clientY: 100 + SCRUB_PIXELS_PER_STEP * 3 }));
        expect(write).toHaveBeenLastCalledWith(170);
    });

    it('ignores moves that never began with a press', () => {
        const { input, write } = wire();
        input.dispatchEvent(pointer('pointermove', { clientY: 400 }));
        expect(write).not.toHaveBeenCalled();
    });

    it('ignores non-primary buttons', () => {
        const { input, write } = wire();
        input.dispatchEvent(pointer('pointerdown', { clientY: 100, button: 2 }));
        input.dispatchEvent(pointer('pointermove', { clientY: 40 }));
        expect(write).not.toHaveBeenCalled();
    });

    it('nudges by one step on the arrow keys', () => {
        const { input, write } = wire(200);
        input.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'ArrowUp' }));
        expect(write).toHaveBeenLastCalledWith(210);
        input.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'ArrowDown' }));
        expect(write).toHaveBeenLastCalledWith(200);
    });

    it('brackets a run of arrow nudges as one gesture, so the field survives repeats', () => {
        vi.useFakeTimers();
        const { input, write, onStart, onEnd } = wire(200);
        const arrow = () => input.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'ArrowUp' }));

        arrow();
        arrow();
        arrow();
        expect(onStart).toHaveBeenCalledOnce();
        expect(onEnd).not.toHaveBeenCalled();
        expect(write).toHaveBeenLastCalledWith(230);

        vi.advanceTimersByTime(SCRUB_KEY_HOLD_MS + 10);
        expect(onEnd).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });

    it('attaches only once per element', () => {
        const { input, write } = wire(200);
        attachNumberScrub(input, { read: () => 200, write });
        input.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
        input.dispatchEvent(pointer('pointermove', { clientY: 100 - SCRUB_PIXELS_PER_STEP }));
        expect(write).toHaveBeenCalledTimes(1);
    });
});
