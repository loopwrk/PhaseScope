/* Oscillation displacement - REFERENCE IMPLEMENTATION.
 *
 * The live displacement runs on the GPU (injected into the point/line
 * vertex shaders by useCorridorRenderer); this function is its TypeScript
 * twin, kept in lockstep so the behaviour stays testable. If you change
 * one, change both - the GLSL mirrors this line for line.
 *
 * All modes displace a point from its anchor along a three-axis sine with
 * fixed per-axis phase offsets (60/120 degrees) so motion reads as 3D:
 *   wave       ripples backward from the corridor head: spatial phase by
 *              distance-from-head, intensity from the frame's avg amplitude
 *   per-frame  all points of a frame move together at the frame's averages
 *   per-point  each point at its own analysed frequency/amplitude
 */

export type OscillationMode = 'wave' | 'per-frame' | 'per-point';

export const PHASE_SHIFT_Y = Math.PI / 3; // 60 deg
export const PHASE_SHIFT_Z = (2 * Math.PI) / 3; // 120 deg
export const WAVE_SPEED = 1.5; // cycles per second
export const WAVE_LENGTH = 15; // frames per wave cycle

export interface OscillationInputs {
    mode: OscillationMode;
    time: number;
    pointFreq: number;
    pointAmp: number;
    frameAvgFreq: number;
    frameAvgAmp: number;
    frameIndex: number;
    builtFrames: number;
}

export function oscillationOffset(i: OscillationInputs): { dx: number; dy: number; dz: number } {
    let phase: number;
    let amp: number;

    if (i.mode === 'wave') {
        const distanceFromHead = i.builtFrames - 1 - i.frameIndex;
        const spatialPhase = (distanceFromHead / WAVE_LENGTH) * 2 * Math.PI;
        phase = 2 * Math.PI * WAVE_SPEED * i.time - spatialPhase;
        amp = i.frameAvgAmp;
    } else if (i.mode === 'per-frame') {
        phase = 2 * Math.PI * i.frameAvgFreq * i.time;
        amp = i.frameAvgAmp;
    } else {
        phase = 2 * Math.PI * i.pointFreq * i.time;
        amp = i.pointAmp;
    }

    return {
        dx: Math.sin(phase) * amp,
        dy: Math.sin(phase + PHASE_SHIFT_Y) * amp,
        dz: Math.sin(phase + PHASE_SHIFT_Z) * amp,
    };
}
