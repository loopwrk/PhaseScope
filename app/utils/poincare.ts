import { parallelTransportFrames } from '~/utils/spine';

/* Poincaré sphere - the polarization trajectory of the stereo field.

   A stereo signal (L, R) is a transverse two-component wave, mathematically
   identical to the electric field of a light beam. Its polarization state is the
   Stokes vector:

     S0 = <L^2> + <R^2>     total power (loudness)
     S1 = <L^2> - <R^2>     left/right balance        (horizontal vs vertical)
     S2 = 2<L R>            in-phase correlation       (diagonal)
     S3 = circularity       quadrature correlation     (does L lead/lag R by 90deg)

   Normalised by S0, (s1, s2, s3) lives in the unit ball: on the surface when the
   field is fully polarised (coherent stereo), drifting toward the centre as it
   decorrelates. The poles (|s3| = 1) are the quadrature "breathing circle"
   Lissajous; the equator is in-phase (one side) and anti-phase (its antipode).

   The topology traces this vector's path over the track - a luminous filament
   winding over a sphere of pure stereo states. S3 is estimated WITHOUT a Hilbert
   transform: the (L,R) phasor's signed area rate (L*dR - R*dL, its angular
   momentum) divided by the instantaneous frequency sqrt(<dL^2+dR^2>/<L^2+R^2>) -
   exact for a single tone, robust for music. The spine is then handed to the
   shared parallel-transport machinery for tube frames. Pure. */

const SILENCE = 1e-9;

/** Normalised Stokes vector (s1, s2, s3) of a window of stereo audio, in the
 *  unit ball. (0,0,0) for silence; |s| -> 1 as the field becomes fully polarised. */
export const stokesVector = (
    ch0: Float32Array,
    ch1: Float32Array,
    start: number,
    length: number
): { s1: number; s2: number; s3: number } => {
    const end = Math.min(start + length, ch0.length - 1);
    let A = 0; // sum L^2
    let B = 0; // sum R^2
    let C = 0; // sum L R
    let D = 0; // sum (L dR - R dL)  - the phasor's signed area rate
    let E = 0; // sum (dL^2 + dR^2)  - derivative power (for the frequency estimate)
    for (let i = Math.max(0, start); i < end; i++) {
        const L = ch0[i] ?? 0;
        const R = ch1[i] ?? 0;
        const dL = (ch0[i + 1] ?? 0) - L;
        const dR = (ch1[i + 1] ?? 0) - R;
        A += L * L;
        B += R * R;
        C += L * R;
        D += L * dR - R * dL;
        E += dL * dL + dR * dR;
    }
    const S0 = A + B;
    if (S0 < SILENCE) return { s1: 0, s2: 0, s3: 0 };

    const omega = Math.sqrt(E / S0); // mean angular frequency, rad/sample
    const S3 = omega > SILENCE ? D / omega : 0;

    let s1 = (A - B) / S0;
    let s2 = (2 * C) / S0;
    let s3 = S3 / S0;
    // Numerical guard: keep the state inside the unit ball (degree of
    // polarisation <= 1). S1/S2 alone always satisfy this; the S3 estimate can
    // nudge slightly past on transients.
    const mag = Math.sqrt(s1 * s1 + s2 * s2 + s3 * s3);
    if (mag > 1) {
        s1 /= mag;
        s2 /= mag;
        s3 /= mag;
    }
    return { s1, s2, s3 };
};

/** Pre-compute the Poincaré-sphere spine: one Stokes vector per frame, smoothed
 *  across time and scaled onto a sphere of `radius`, plus its tube frames.
 *  Circularity (s3) maps to the vertical axis, so the quadrature poles sit
 *  top/bottom and the in/anti-phase equator runs horizontal. */
export const precomputePoincareSpine = (
    frameCount: number,
    ch0: Float32Array,
    ch1: Float32Array,
    hopSize: number,
    windowSize: number,
    radius = 5,
    smoothing = 0.3 // EMA weight on each new frame; lower = smoother, more lag
): { spine: Float32Array; normals: Float32Array; binormals: Float32Array } => {
    const spine = new Float32Array(frameCount * 3);
    let ex = 0;
    let ey = 0;
    let ez = 0;
    for (let f = 0; f < frameCount; f++) {
        const { s1, s2, s3 } = stokesVector(ch0, ch1, f * hopSize, windowSize);
        if (f === 0) {
            ex = s1;
            ey = s2;
            ez = s3;
        } else {
            ex += smoothing * (s1 - ex);
            ey += smoothing * (s2 - ey);
            ez += smoothing * (s3 - ez);
        }
        spine[f * 3] = ex * radius; // s1: L/R balance        -> X
        spine[f * 3 + 1] = ez * radius; // s3: circularity     -> Y (poles)
        spine[f * 3 + 2] = ey * radius; // s2: correlation     -> Z
    }
    const { normals, binormals } = parallelTransportFrames(spine, frameCount);
    return { spine, normals, binormals };
};
