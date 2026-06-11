export type OscillationMode = 'per-point' | 'per-frame' | 'wave';

interface OscillationState {
    pos: Float32Array | null;
    frequencies: Float32Array | null;
    amplitudes: Float32Array | null;
    anchorPositions: Float32Array | null;
    builtFrames: number;
}

interface OscillationMeta {
    pointsPerFrame: number;
}

interface UseOscillationOptions {
    /** Callback to mark geometry for GPU update */
    onUpdate?: () => void;
}

/* All modes displace points from their anchors along the same three-axis
   sine, with phase offsets per axis to create 3D motion. They differ only
   in what drives the phase/amplitude: per-point (each point's own
   frequency), per-frame (frame averages), or wave (spatial phase rippling
   back from the corridor head). */
const PHASE_SHIFT_Y = Math.PI / 3; // 60 deg
const PHASE_SHIFT_Z = (2 * Math.PI) / 3; // 120 deg
const STRIDE = 3; // x, y, z

export function useOscillation(options: UseOscillationOptions = {}) {
    const { onUpdate } = options;
    // useState (not ref) so the user's oscillation settings survive
    // navigating away from the page; keys documented in useScopeSettings.
    const enabled = useState('scope:oscillation-enabled', () => true);
    const mode = useState<OscillationMode>('scope:oscillation-mode', () => 'wave');

    /** Write `anchor + sin offset` for `count` points starting at point index `start`. */
    const displaceRange = (
        pos: Float32Array,
        anchors: Float32Array,
        start: number,
        count: number,
        phase: number,
        amp: number
    ) => {
        const oscX = Math.sin(phase) * amp;
        const oscY = Math.sin(phase + PHASE_SHIFT_Y) * amp;
        const oscZ = Math.sin(phase + PHASE_SHIFT_Z) * amp;
        for (let k = 0; k < count; k++) {
            const p = (start + k) * STRIDE;
            pos[p] = (anchors[p] ?? 0) + oscX;
            pos[p + 1] = (anchors[p + 1] ?? 0) + oscY;
            pos[p + 2] = (anchors[p + 2] ?? 0) + oscZ;
        }
    };

    /** Mean frequency / amplitude over one frame's block of points. */
    const frameAverages = (
        frequencies: Float32Array,
        amplitudes: Float32Array,
        frameStartPoint: number,
        pointsPerFrame: number
    ) => {
        let avgFreq = 0;
        let avgAmp = 0;
        for (let k = 0; k < pointsPerFrame; k++) {
            avgFreq += frequencies[frameStartPoint + k] ?? 0;
            avgAmp += amplitudes[frameStartPoint + k] ?? 0;
        }
        return { avgFreq: avgFreq / pointsPerFrame, avgAmp: avgAmp / pointsPerFrame };
    };

    /**
     * Apply oscillation to all built points based on their stored frequency data.
     *
     * @param time: Current time in seconds (used for phase calculation)
     * @param state: Current corridor/sphere state containing position and oscillation data
     * @param meta: Metadata about the corridor structure
     */
    const oscillate = (time: number, state: OscillationState, meta: OscillationMeta) => {
        const { pos, frequencies, amplitudes, anchorPositions, builtFrames } = state;
        const { pointsPerFrame } = meta;

        if (!pos || !frequencies || !amplitudes || !anchorPositions) return;
        if (builtFrames === 0) return;

        if (mode.value === 'per-point') {
            // Each point oscillates independently at its own frequency.
            const totalBuiltPoints = builtFrames * pointsPerFrame;
            for (let i = 0; i < totalBuiltPoints; i++) {
                const phase = 2 * Math.PI * (frequencies[i] ?? 0) * time;
                displaceRange(pos, anchorPositions, i, 1, phase, amplitudes[i] ?? 0);
            }
        } else if (mode.value === 'per-frame') {
            // All points in a frame move together at the frame's average
            // frequency; preserves the ring shape.
            for (let frame = 0; frame < builtFrames; frame++) {
                const frameStartPoint = frame * pointsPerFrame;
                const { avgFreq, avgAmp } = frameAverages(frequencies, amplitudes, frameStartPoint, pointsPerFrame);
                const phase = 2 * Math.PI * avgFreq * time;
                displaceRange(pos, anchorPositions, frameStartPoint, pointsPerFrame, phase, avgAmp);
            }
        } else {
            // Wave: oscillation ripples backward from the corridor head; frame
            // amplitude modulates intensity, so louder sections make bigger waves.
            const waveSpeed = 1.5; // cycles per second
            const waveLength = 15; // frames per wave cycle
            for (let frame = 0; frame < builtFrames; frame++) {
                const frameStartPoint = frame * pointsPerFrame;
                const { avgAmp } = frameAverages(frequencies, amplitudes, frameStartPoint, pointsPerFrame);
                const distanceFromHead = builtFrames - 1 - frame;
                const spatialPhase = (distanceFromHead / waveLength) * 2 * Math.PI;
                const phase = 2 * Math.PI * waveSpeed * time - spatialPhase;
                displaceRange(pos, anchorPositions, frameStartPoint, pointsPerFrame, phase, avgAmp);
            }
        }

        onUpdate?.();
    };

    /**
     * Restore all points to their original anchor positions.
     * Call this when disabling oscillation to return to smooth curves.
     */
    const restoreAnchorPositions = (state: OscillationState, meta: OscillationMeta) => {
        const { pos, anchorPositions, builtFrames } = state;
        const { pointsPerFrame } = meta;

        if (!pos || !anchorPositions || builtFrames === 0) return;

        const totalPoints = builtFrames * pointsPerFrame * STRIDE;
        for (let i = 0; i < totalPoints; i++) {
            pos[i] = anchorPositions[i] ?? 0;
        }

        onUpdate?.();
    };

    return {
        enabled,
        mode,
        oscillate,
        restoreAnchorPositions,
    };
}
