import type { Ref } from 'vue';

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

export function useOscillation(options: UseOscillationOptions = {}) {
    if (import.meta.server) {
        return {
            enabled: ref(false),
            mode: ref<OscillationMode>('wave'),
            oscillate: () => {},
            restoreAnchorPositions: () => {},
        };
    }

    const { onUpdate } = options;
    const enabled = ref(true);

    const mode = ref<OscillationMode>('wave');

    /**
     * Apply oscillation to all built points based on their stored frequency data.
     *
     * @param time: Current time in seconds (used for phase calculation)
     * @param state: Current corridor/sphere state containing position and oscillation data
     * @param meta: Metadata about the corridor structure
     */
    const oscillate = (time: number, state: OscillationState, meta: OscillationMeta) => {
        const { pos, frequencies, amplitudes, anchorPositions, builtFrames } = state;

        if (!pos || !frequencies || !amplitudes || !anchorPositions) return;
        if (builtFrames === 0) return;

        if (mode.value === 'per-frame') {
            oscillatePerFrame(time, state, meta);
        } else if (mode.value === 'wave') {
            oscillateWave(time, state, meta);
        } else {
            oscillatePerPoint(time, state, meta);
        }

        onUpdate?.();
    };

    /**
     * Per-point oscillation: Each point oscillates independently at its own frequency..
     */
    const oscillatePerPoint = (time: number, state: OscillationState, meta: OscillationMeta) => {
        const { pos, frequencies, amplitudes, anchorPositions, builtFrames } = state;
        const { pointsPerFrame } = meta;

        if (!pos || !frequencies || !amplitudes || !anchorPositions) return;

        const totalBuiltPoints = builtFrames * pointsPerFrame;
        const positionArrayStride = 3;
        const phaseCalcMultiplier = 2;
        const phaseShiftY = Math.PI / 3; // 60° phase offset for Y-axis
        const phaseShiftZ = (2 * Math.PI) / 3; // 120° phase offset for Z-axis

        for (let i = 0; i < totalBuiltPoints; i++) {
            const p = i * positionArrayStride;
            const freq = frequencies[i] ?? 0;
            const amp = amplitudes[i] ?? 0;

            // Calculate oscillation using sine wave at the point's frequency
            // Use slight phase offsets for each axis to create 3D motion
            const phase = phaseCalcMultiplier * Math.PI * freq * time;
            const oscX = Math.sin(phase) * amp;
            const oscY = Math.sin(phase + phaseShiftY) * amp;
            const oscZ = Math.sin(phase + phaseShiftZ) * amp;

            // Update position by adding oscillation to anchor position
            pos[p] = (anchorPositions[p] ?? 0) + oscX;
            pos[p + 1] = (anchorPositions[p + 1] ?? 0) + oscY;
            pos[p + 2] = (anchorPositions[p + 2] ?? 0) + oscZ;
        }
    };

    /**
     * Per-frame oscillation: All points in a frame oscillate together coherently.
     * Preserves the shape of each ring/slice while still showing frequency characteristics as averages of points in a ring.
     */
    const oscillatePerFrame = (time: number, state: OscillationState, meta: OscillationMeta) => {
        const { pos, frequencies, amplitudes, anchorPositions, builtFrames } = state;
        const { pointsPerFrame } = meta;

        if (!pos || !frequencies || !amplitudes || !anchorPositions) return;

        const positionArrayStride = 3;
        const phaseCalcMultiplier = 2;
        const phaseShiftY = Math.PI / 3;
        const phaseShiftZ = (2 * Math.PI) / 3;

        for (let frame = 0; frame < builtFrames; frame++) {
            const frameStartPoint = frame * pointsPerFrame;

            // Calculate average frequency and amplitude for this frame
            let avgFreq = 0;
            let avgAmp = 0;
            for (let k = 0; k < pointsPerFrame; k++) {
                const pointIndex = frameStartPoint + k;
                avgFreq += frequencies[pointIndex] ?? 0;
                avgAmp += amplitudes[pointIndex] ?? 0;
            }
            avgFreq /= pointsPerFrame;
            avgAmp /= pointsPerFrame;

            // Apply the same oscillation to all points in this frame
            const phase = phaseCalcMultiplier * Math.PI * avgFreq * time;
            const oscX = Math.sin(phase) * avgAmp;
            const oscY = Math.sin(phase + phaseShiftY) * avgAmp;
            const oscZ = Math.sin(phase + phaseShiftZ) * avgAmp;

            for (let k = 0; k < pointsPerFrame; k++) {
                const pointIndex = frameStartPoint + k;
                const p = pointIndex * positionArrayStride;

                pos[p] = (anchorPositions[p] ?? 0) + oscX;
                pos[p + 1] = (anchorPositions[p + 1] ?? 0) + oscY;
                pos[p + 2] = (anchorPositions[p + 2] ?? 0) + oscZ;
            }
        }
    };

    /**
     * Wave oscillation: Oscillation ripples outward from the corridor head.
     * Creates a flowing wave effect where motion propagates through the structure.
     * Uses frame amplitude to modulate wave intensity. Louder sections create bigger waves.
     */
    const oscillateWave = (time: number, state: OscillationState, meta: OscillationMeta) => {
        const { pos, amplitudes, anchorPositions, builtFrames } = state;
        const { pointsPerFrame } = meta;

        if (!pos || !amplitudes || !anchorPositions) return;

        const positionArrayStride = 3;
        const waveSpeed = 1.5; // How fast the wave propagates (cycles per second)
        const waveLength = 15; // How many frames per wave cycle
        const phaseShiftY = Math.PI / 3;
        const phaseShiftZ = (2 * Math.PI) / 3;

        for (let frame = 0; frame < builtFrames; frame++) {
            const frameStartPoint = frame * pointsPerFrame;

            // Calculate average amplitude for this frame
            let avgAmp = 0;
            for (let k = 0; k < pointsPerFrame; k++) {
                const pointIndex = frameStartPoint + k;
                avgAmp += amplitudes[pointIndex] ?? 0;
            }
            avgAmp /= pointsPerFrame;

            // Calculate phase based on distance from head (builtFrames - 1)
            // Wave travels backward from head through the corridor
            const distanceFromHead = builtFrames - 1 - frame;
            const spatialPhase = (distanceFromHead / waveLength) * 2 * Math.PI;

            // Combine time-based animation with spatial phase for wave propagation
            const phase = 2 * Math.PI * waveSpeed * time - spatialPhase;
            const oscX = Math.sin(phase) * avgAmp;
            const oscY = Math.sin(phase + phaseShiftY) * avgAmp;
            const oscZ = Math.sin(phase + phaseShiftZ) * avgAmp;

            for (let k = 0; k < pointsPerFrame; k++) {
                const pointIndex = frameStartPoint + k;
                const p = pointIndex * positionArrayStride;

                pos[p] = (anchorPositions[p] ?? 0) + oscX;
                pos[p + 1] = (anchorPositions[p + 1] ?? 0) + oscY;
                pos[p + 2] = (anchorPositions[p + 2] ?? 0) + oscZ;
            }
        }
    };

    /**
     * Restore all points to their original anchor positions.
     * Call this when disabling oscillation to return to smooth curves.
     */
    const restoreAnchorPositions = (state: OscillationState, meta: OscillationMeta) => {
        const { pos, anchorPositions, builtFrames } = state;
        const { pointsPerFrame } = meta;

        if (!pos || !anchorPositions || builtFrames === 0) return;

        const totalPoints = builtFrames * pointsPerFrame * 3;
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
