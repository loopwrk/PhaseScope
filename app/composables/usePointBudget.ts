import type { Ref } from 'vue';
import type { CorridorMeta } from '~/utils/topologies';

/* usePointBudget - the vertex-count arithmetic behind the Display panel's
   performance readout. How many frames the loaded audio can yield, how many
   points that costs at the current density, what survives the coverage
   slider, and when to warn. Pure derivation over injected state; the
   geometry engine composes it and spreads it into its own API. */

// Performance warning thresholds. Tuned for the optimised engine (ranged
// GPU uploads, shared buffers, shader-side oscillation): the old limits
// were upload/CPU-bound; the remaining ceiling is raw vertex throughput.
const POINTS_WARNING_THRESHOLD = 8_000_000;
const POINTS_DANGER_THRESHOLD = 20_000_000;

/** Format large point counts for display: 1_500_000 -> "1.5M", 200_000 -> "200K". */
export const formatPointCount = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
    return count.toString();
};

interface UsePointBudgetOptions {
    /** The wav player's reactive audio state (frame count derives from the buffer). */
    audio: { buffer: AudioBuffer | null };
    corridorMeta: Ref<CorridorMeta>;
    trackCoveragePercent: Ref<number>;
}

export function usePointBudget(options: UsePointBudgetOptions) {
    const { audio, corridorMeta, trackCoveragePercent } = options;

    // Total frames possible for the loaded audio
    const totalFramesForTrack = computed(() => {
        if (!audio.buffer) return 0;
        const { windowSize, hopSize } = corridorMeta.value;
        return Math.max(0, Math.floor((audio.buffer.length - windowSize) / hopSize));
    });

    // Total points needed for the full track at current pointsPerFrame
    const totalPointsForFullTrack = computed(() => totalFramesForTrack.value * corridorMeta.value.pointsPerFrame);

    // Effective max points after the coverage slider
    const effectiveMaxPoints = computed(() =>
        Math.floor(totalPointsForFullTrack.value * (trackCoveragePercent.value / 100))
    );

    const pointsWarningLevel = computed<'none' | 'warning' | 'danger'>(() => {
        const points = effectiveMaxPoints.value;
        if (points >= POINTS_DANGER_THRESHOLD) return 'danger';
        if (points >= POINTS_WARNING_THRESHOLD) return 'warning';
        return 'none';
    });

    return {
        totalFramesForTrack,
        totalPointsForFullTrack,
        effectiveMaxPoints,
        pointsWarningLevel,
        formatPointCount,
    };
}
