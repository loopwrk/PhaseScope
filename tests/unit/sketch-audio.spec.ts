import { describe, it, expect } from 'vitest';
import {
    byteRms,
    formatLoopLabel,
    formatTime,
    litSegments,
    loopedPlayhead,
    waveformPeaks,
} from '~/utils/sketch/audio';

describe('waveformPeaks', () => {
    it('takes the absolute peak per window', () => {
        const samples = [0.1, -0.9, 0.2, 0.4, -0.3, 0.05];
        expect(waveformPeaks(samples, 3)).toEqual([0.9, 0.4, 0.3]);
    });

    it('handles empty buffers and more bars than samples', () => {
        expect(waveformPeaks([], 4)).toEqual([0, 0, 0, 0]);
        expect(waveformPeaks([0.5], 3)).toHaveLength(3);
    });
});

describe('loopedPlayhead', () => {
    const loop = { start: 2, end: 8, enabled: true };

    it('runs linearly before the loop end', () => {
        expect(loopedPlayhead(0, 5, 10, loop)).toBe(5);
    });

    it('cycles inside the loop after passing the end', () => {
        expect(loopedPlayhead(0, 9, 10, loop)).toBe(2 + (9 - 2) % 6);
        expect(loopedPlayhead(0, 15, 10, loop)).toBe(2 + (15 - 2) % 6);
    });

    it('clamps to duration when the loop is off', () => {
        expect(loopedPlayhead(0, 15, 10, { ...loop, enabled: false })).toBe(10);
    });

    it('ignores an inverted or empty loop region', () => {
        expect(loopedPlayhead(0, 9, 10, { start: 5, end: 5, enabled: true })).toBe(9);
    });
});

describe('meter mapping', () => {
    it('byteRms reads silence as 0 and full-scale as ~1', () => {
        expect(byteRms(new Uint8Array([128, 128, 128]))).toBe(0);
        expect(byteRms(new Uint8Array([0, 255, 0, 255]))).toBeGreaterThan(0.9);
    });

    it('litSegments maps silence to 0 and full scale to all segments', () => {
        expect(litSegments(0)).toBe(0);
        expect(litSegments(1)).toBe(8);
        const half = litSegments(0.1); // -20dB - mid-scale
        expect(half).toBeGreaterThan(2);
        expect(half).toBeLessThan(8);
    });
});

describe('time formatting', () => {
    it('formats minutes, seconds and hundredths separately', () => {
        expect(formatTime(64.487)).toEqual({ main: '1:04', hundredths: '.48' });
        expect(formatTime(0)).toEqual({ main: '0:00', hundredths: '.00' });
        expect(formatTime(-1)).toEqual({ main: '0:00', hundredths: '.00' });
    });

    it('formats loop captions with tenths', () => {
        expect(formatLoopLabel(2.13)).toBe('0:02.1');
        expect(formatLoopLabel(68.4)).toBe('1:08.4');
    });
});
