import { describe, it, expect } from 'vitest';
import { createFrameClock } from '~/utils/sketch/frame-clock';

describe('createFrameClock', () => {
    it('starts stopped at zero', () => {
        const clock = createFrameClock();
        expect(clock.seconds).toBe(0);
        expect(clock.running).toBe(false);
    });

    it('does not advance until started', () => {
        const clock = createFrameClock();
        expect(clock.advance(5_000)).toBe(0);
    });

    it('counts seconds from the moment it started, not from zero', () => {
        const clock = createFrameClock();
        clock.start(10_000);
        expect(clock.advance(10_500)).toBeCloseTo(0.5, 10);
        expect(clock.advance(12_000)).toBeCloseTo(2, 10);
    });

    it('holds its reading while stopped, however much time passes', () => {
        const clock = createFrameClock();
        clock.start(0);
        clock.advance(3_000);
        clock.stop();

        expect(clock.advance(60_000)).toBeCloseTo(3, 10);
        expect(clock.seconds).toBeCloseTo(3, 10);
    });

    it('resumes from where it stopped instead of snapping back', () => {
        const clock = createFrameClock();
        clock.start(0);
        clock.advance(3_000);
        clock.stop();

        /* a minute of real time passes with the canvas frozen */
        clock.start(63_000);
        expect(clock.advance(63_500)).toBeCloseTo(3.5, 10);
    });

    it('survives repeated stop/start without drifting', () => {
        const clock = createFrameClock();
        let now = 0;
        for (let i = 0; i < 5; i++) {
            clock.start(now);
            now += 1_000;
            clock.advance(now);
            clock.stop();
            now += 10_000; // idle, should contribute nothing
        }
        expect(clock.seconds).toBeCloseTo(5, 10);
    });
});
