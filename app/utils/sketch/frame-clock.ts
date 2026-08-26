/* The clock a sketch's render(ctx, t) is driven from.

   Time advances only while the clock runs, and holds its reading when it
   stops - so a frozen canvas can be repainted at exactly the phase it
   froze on, and starting again carries on from there instead of snapping
   back to zero. That is the whole reason this is not just
   `(now - startedAt) / 1000`. */

export interface FrameClock {
    /* Seconds handed to the sketch. */
    readonly seconds: number;
    readonly running: boolean;
    start: (nowMs: number) => void;
    stop: () => void;
    /* Advance to `nowMs` and return the new reading. A no-op while stopped,
       which is what keeps a held frame on its phase. */
    advance: (nowMs: number) => number;
}

export function createFrameClock(): FrameClock {
    let elapsed = 0;
    /* What the clock read when this run began. */
    let base = 0;
    let startedAt = 0;
    let running = false;

    return {
        get seconds() {
            return elapsed;
        },
        get running() {
            return running;
        },
        start(nowMs: number) {
            base = elapsed;
            startedAt = nowMs;
            running = true;
        },
        stop() {
            running = false;
        },
        advance(nowMs: number) {
            if (running) elapsed = base + (nowMs - startedAt) / 1000;
            return elapsed;
        },
    };
}
