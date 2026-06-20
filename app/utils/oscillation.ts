/* Oscillation displacement - REFERENCE IMPLEMENTATION.
 *
 * The live displacement runs on the GPU (injected into the point/line
 * vertex shaders by useCorridorRenderer); this function is its TypeScript
 * twin, kept in lockstep so the behaviour stays testable. If you change
 * one, change both - the GLSL mirrors this line for line.
 *
 * All modes displace a point from its anchor along a three-axis sine with
 * fixed per-axis phase offsets (60/120 degrees) so motion reads as 3D:
 *   expressiveness  each point at its own analysed local frequency/amplitude -
 *                   the liveliest, most individuated motion
 *   intensity       loudness as a ripple backward from the corridor head:
 *                   spatial phase by distance-from-head, width from avg amplitude
 *   frequency       all points of a frame move together at the frame's centroid
 *
 * frameAvgFreq carries the frame's real spectral centroid (Hz); frameAvgAmp the
 * frame's mean oscillation amplitude.
 */

export type OscillationMode = 'expressiveness' | 'intensity' | 'frequency';

export const PHASE_SHIFT_Y = Math.PI / 3; // 60 deg
export const PHASE_SHIFT_Z = (2 * Math.PI) / 3; // 120 deg
export const WAVE_SPEED = 1.5; // intensity ripple: cycles per second
export const WAVE_LENGTH = 15; // intensity ripple: frames per wave cycle

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

    if (i.mode === 'intensity') {
        // loudness ripple backward from the head, at a fixed visible speed
        const distanceFromHead = i.builtFrames - 1 - i.frameIndex;
        const spatialPhase = (distanceFromHead / WAVE_LENGTH) * 2 * Math.PI;
        phase = 2 * Math.PI * WAVE_SPEED * i.time - spatialPhase;
        amp = i.frameAvgAmp;
    } else if (i.mode === 'frequency') {
        // whole frame together at its spectral centroid
        phase = 2 * Math.PI * i.frameAvgFreq * i.time;
        amp = i.frameAvgAmp;
    } else {
        // expressiveness: each point at its own analysed local frequency
        phase = 2 * Math.PI * i.pointFreq * i.time;
        amp = i.pointAmp;
    }

    return {
        dx: Math.sin(phase) * amp,
        dy: Math.sin(phase + PHASE_SHIFT_Y) * amp,
        dz: Math.sin(phase + PHASE_SHIFT_Z) * amp,
    };
}
