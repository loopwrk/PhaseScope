/* Drag-to-adjust for numeric fields.

   Press and drag up to raise a value, down to lower it. A press that
   never moves stays a plain click, so click-to-type is untouched; only
   once the pointer passes a few pixels does it become a drag.

   Step size comes from the value's own magnitude, snapped to a power of
   ten, so one drag feels the same whether the field holds 0.4 or 48000
   and the numbers stay round: a tenth of the value's leading order, so
   200 moves in 10s and 0.4 in hundredths. Alt drops a decade for fine
   work, shift gains one. The step is taken once at the start of a drag -
   recomputing it as the value moves would change the sensitivity under
   the user's hand. */

/* Pixels of travel per step. Small enough to feel direct, large enough
   that a twitch does not move the value. */
export const SCRUB_PIXELS_PER_STEP = 4;
/* Under this a press is a click, not a drag. */
export const SCRUB_THRESHOLD_PX = 3;
/* How long a run of arrow-key nudges is treated as one gesture. Held so
   the field is not torn down and refocused between key repeats. */
export const SCRUB_KEY_HOLD_MS = 400;

/* A tenth of the value's leading order: 200 -> 10, 0.4 -> 0.01,
   48000 -> 1000. Zero has no magnitude to read, so it starts somewhere
   useful for a 0..1 param. */
export function scrubStep(value: number): number {
    if (!Number.isFinite(value) || value === 0) return 0.01;
    return 10 ** (Math.floor(Math.log10(Math.abs(value))) - 1);
}

export function scrubMultiplier(modifiers: { shiftKey?: boolean; altKey?: boolean }): number {
    if (modifiers.shiftKey) return 10;
    if (modifiers.altKey) return 0.1;
    return 1;
}

/* Screen y grows downward; dragging up has to increase. The `|| 0`
   normalises the -0 that Math.round returns for a small downward drag. */
export function stepsFromDelta(deltaY: number): number {
    return Math.round(-deltaY / SCRUB_PIXELS_PER_STEP) || 0;
}

function decimalsOf(value: number): number {
    const [, fraction = ''] = String(value).split('.');
    return fraction.length;
}

/* Rounded to whichever is finer, the step or the value it started from -
   so a long drag cannot accumulate binary float noise, and a value the
   user typed at higher precision does not get truncated by a coarse
   step. */
export function scrubbedValue(startValue: number, steps: number, multiplier = 1): number {
    const step = scrubStep(startValue) * multiplier;
    const stepDecimals = Math.max(0, -Math.round(Math.log10(step)));
    const decimals = Math.min(20, Math.max(stepDecimals, decimalsOf(startValue)));
    return Number((startValue + steps * step).toFixed(decimals));
}

export interface ScrubTarget {
    /* The value a drag starts from. */
    read: () => number;
    /* Called for each step of the drag, and for each arrow-key nudge. */
    write: (value: number) => void;
    /* Bracket the drag - the caller uses this to hold off any re-render
       that would destroy the element being dragged. */
    onStart?: () => void;
    onEnd?: () => void;
}

/* Idempotent: attaching twice to the same element is a no-op, so callers
   re-running over already-wired DOM stay cheap. Listeners live and die
   with the element, so there is nothing to tear down. */
export function attachNumberScrub(input: HTMLInputElement, target: ScrubTarget): void {
    if (input.dataset.scrub === 'on') return;
    input.dataset.scrub = 'on';

    let startY = 0;
    let startValue = 0;
    let armed = false;
    let dragging = false;

    input.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        armed = true;
        dragging = false;
        startY = event.clientY;
        startValue = target.read();
    });

    input.addEventListener('pointermove', (event) => {
        if (!armed) return;
        const deltaY = event.clientY - startY;
        if (!dragging) {
            if (Math.abs(deltaY) < SCRUB_THRESHOLD_PX) return;
            dragging = true;
            input.setPointerCapture?.(event.pointerId);
            target.onStart?.();
        }
        /* Keeps the drag from turning into a text selection. */
        event.preventDefault();
        target.write(scrubbedValue(startValue, stepsFromDelta(deltaY), scrubMultiplier(event)));
    });

    function end(event: PointerEvent) {
        if (dragging) {
            input.releasePointerCapture?.(event.pointerId);
            target.onEnd?.();
        }
        armed = false;
        dragging = false;
    }
    input.addEventListener('pointerup', end);
    input.addEventListener('pointercancel', end);

    /* Keyboard parity with the drag, and what a number field owes anyway.
       Key repeats are bracketed like a drag: without the hold, the first
       nudge would re-render the equation and take the focused field with
       it, so the second press would land on nothing. */
    let keyHeld = false;
    let keyHoldTimer: ReturnType<typeof setTimeout> | undefined;
    input.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        if (!keyHeld) {
            keyHeld = true;
            target.onStart?.();
        }
        clearTimeout(keyHoldTimer);
        keyHoldTimer = setTimeout(() => {
            keyHeld = false;
            target.onEnd?.();
        }, SCRUB_KEY_HOLD_MS);
        target.write(scrubbedValue(target.read(), event.key === 'ArrowUp' ? 1 : -1, scrubMultiplier(event)));
    });
}
