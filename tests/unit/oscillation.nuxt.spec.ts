// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest';
import { useOscillation } from '~/composables/useOscillation.client';

/* The oscillation invariants the renderer depends on: anchors are the
   ground truth (restore must be exact), per-frame mode preserves ring
   shape (one displacement per frame), and no mode ever displaces a point
   further than its stored amplitude allows. Runs in the nuxt environment
   for the composable's auto-imported reactivity. */

const POINTS_PER_FRAME = 4;
const FRAMES = 2;

function fixture() {
    const total = FRAMES * POINTS_PER_FRAME;
    const anchorPositions = Float32Array.from({ length: total * 3 }, (_, i) => Math.sin(i * 1.7) * 5);
    const state = {
        pos: Float32Array.from(anchorPositions),
        // frame 0 oscillates at 1 Hz, frame 1 at 2 Hz
        frequencies: Float32Array.from({ length: total }, (_, i) => (i < POINTS_PER_FRAME ? 1 : 2)),
        amplitudes: new Float32Array(total).fill(0.1),
        anchorPositions,
        builtFrames: FRAMES,
    };
    return { state, meta: { pointsPerFrame: POINTS_PER_FRAME } };
}

describe('useOscillation', () => {
    it('restoreAnchorPositions returns every point exactly to its anchor', () => {
        const onUpdate = vi.fn();
        const osc = useOscillation({ onUpdate });
        const { state, meta } = fixture();
        state.pos.fill(999); // scramble
        osc.restoreAnchorPositions(state, meta);
        expect(state.pos).toEqual(state.anchorPositions);
        expect(onUpdate).toHaveBeenCalled();
    });

    it.each(['wave', 'per-frame', 'per-point'] as const)(
        '%s mode never displaces a point further than its amplitude',
        (mode) => {
            const osc = useOscillation();
            osc.mode.value = mode;
            const { state, meta } = fixture();
            osc.oscillate(0.37, state, meta);
            for (let i = 0; i < state.pos.length; i++) {
                const d = Math.abs(state.pos[i]! - state.anchorPositions[i]!);
                expect(d).toBeLessThanOrEqual(0.1 + 1e-6);
            }
        }
    );

    it('per-frame mode moves all points of a frame as one rigid offset', () => {
        const osc = useOscillation();
        osc.mode.value = 'per-frame';
        const { state, meta } = fixture();
        osc.oscillate(0.37, state, meta);
        for (let frame = 0; frame < FRAMES; frame++) {
            const base = frame * POINTS_PER_FRAME * 3;
            const dx = state.pos[base]! - state.anchorPositions[base]!;
            const dy = state.pos[base + 1]! - state.anchorPositions[base + 1]!;
            const dz = state.pos[base + 2]! - state.anchorPositions[base + 2]!;
            for (let k = 1; k < POINTS_PER_FRAME; k++) {
                const p = base + k * 3;
                expect(state.pos[p]! - state.anchorPositions[p]!).toBeCloseTo(dx, 6);
                expect(state.pos[p + 1]! - state.anchorPositions[p + 1]!).toBeCloseTo(dy, 6);
                expect(state.pos[p + 2]! - state.anchorPositions[p + 2]!).toBeCloseTo(dz, 6);
            }
        }
    });

    it('per-frame mode displaces frames with different average frequencies differently', () => {
        const osc = useOscillation();
        osc.mode.value = 'per-frame';
        const { state, meta } = fixture();
        osc.oscillate(0.37, state, meta);
        const d0 = state.pos[0]! - state.anchorPositions[0]!;
        const d1 = state.pos[POINTS_PER_FRAME * 3]! - state.anchorPositions[POINTS_PER_FRAME * 3]!;
        expect(Math.abs(d0 - d1)).toBeGreaterThan(1e-6);
    });

    it('does nothing when the geometry arrays are missing', () => {
        const onUpdate = vi.fn();
        const osc = useOscillation({ onUpdate });
        osc.oscillate(
            1,
            { pos: null, frequencies: null, amplitudes: null, anchorPositions: null, builtFrames: 0 },
            {
                pointsPerFrame: 4,
            }
        );
        expect(onUpdate).not.toHaveBeenCalled();
    });
});
