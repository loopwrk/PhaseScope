import { describe, it, expect } from 'vitest';
import { ref, shallowReactive } from 'vue';
import { usePointBudget, formatPointCount } from '~/composables/usePointBudget';
import type { CorridorMeta } from '~/utils/topologies';

/* The Display panel's performance readout arithmetic: frames from the
   buffer, points from the density, coverage from the slider, warnings from
   the thresholds. */

const META: CorridorMeta = { zStep: 0.08, pointsPerFrame: 512, windowSize: 2048, hopSize: 1024 };

const mount = (bufferLength: number | null, coverage = 100, meta: Partial<CorridorMeta> = {}) => {
    const audio = shallowReactive({
        buffer: bufferLength === null ? null : ({ length: bufferLength } as AudioBuffer),
    });
    const corridorMeta = ref<CorridorMeta>({ ...META, ...meta });
    const trackCoveragePercent = ref(coverage);
    return {
        audio,
        corridorMeta,
        trackCoveragePercent,
        ...usePointBudget({ audio, corridorMeta, trackCoveragePercent }),
    };
};

describe('formatPointCount', () => {
    it('formats the three magnitudes the readout shows', () => {
        expect(formatPointCount(999)).toBe('999');
        expect(formatPointCount(200_000)).toBe('200K');
        expect(formatPointCount(1_500_000)).toBe('1.5M');
    });
});

describe('usePointBudget', () => {
    it('reports zero frames with no buffer loaded', () => {
        const b = mount(null);
        expect(b.totalFramesForTrack.value).toBe(0);
        expect(b.effectiveMaxPoints.value).toBe(0);
    });

    it('derives frames from buffer length, window and hop', () => {
        // (10240 - 2048) / 1024 = 8 full hops
        const b = mount(10_240);
        expect(b.totalFramesForTrack.value).toBe(8);
        expect(b.totalPointsForFullTrack.value).toBe(8 * 512);
    });

    it('never reports negative frames for a buffer shorter than one window', () => {
        const b = mount(1_000);
        expect(b.totalFramesForTrack.value).toBe(0);
    });

    it('scales the budget with the coverage slider', () => {
        const b = mount(10_240, 50);
        expect(b.effectiveMaxPoints.value).toBe(Math.floor(8 * 512 * 0.5));
        b.trackCoveragePercent.value = 25;
        expect(b.effectiveMaxPoints.value).toBe(Math.floor(8 * 512 * 0.25));
    });

    it('tracks density changes reactively', () => {
        const b = mount(10_240);
        b.corridorMeta.value.pointsPerFrame = 1024;
        expect(b.totalPointsForFullTrack.value).toBe(8 * 1024);
    });

    it('steps the warning level at the tuned thresholds', () => {
        // frames = points / pointsPerFrame; length = frames * hop + window.
        // Point counts here are multiples of 512 so the frame floor is exact.
        const lengthFor = (points: number) => (points / 512) * 1024 + 2048;
        expect(mount(lengthFor(7_999_488)).pointsWarningLevel.value).toBe('none');
        expect(mount(lengthFor(8_000_000)).pointsWarningLevel.value).toBe('warning');
        expect(mount(lengthFor(20_000_768)).pointsWarningLevel.value).toBe('danger');
    });
});
