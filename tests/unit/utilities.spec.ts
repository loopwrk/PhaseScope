import { describe, it, expect } from 'vitest';
import { clamp } from '~/utils/utilities';

describe('clamp', () => {
    it('passes through in-range values', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamps below and above', () => {
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(clamp(11, 0, 10)).toBe(10);
    });

    it('handles infinite bounds (used by the wav player for unknown durations)', () => {
        expect(clamp(123, 0, Infinity)).toBe(123);
        expect(clamp(-123, 0, Infinity)).toBe(0);
    });
});
