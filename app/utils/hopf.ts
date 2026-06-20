import { stokesVector } from '~/utils/poincare';

/* Hopf fibration - the stereo field lifted off the Poincaré sphere into linked rings.

   The Poincaré topology places each frame's stereo state as a POINT on the sphere
   of polarization - which is exactly the Bloch sphere of a spin-1/2 particle (a
   qubit). The Hopf map S^3 -> S^2 is that Bloch map, and it carries a hidden gift:
   every point of the sphere is the image of a whole CIRCLE (a Hopf fibre) on the
   3-sphere, and stereographic projection sends those fibres to perfectly round,
   mutually LINKED circles that fill R^3 (Villarceau circles). So this topology
   draws, for each frame, not a point but its entire fibre; and as the stereo
   state wanders the track the fibres thread through one another - the literal
   fibration of the stereo signal over time. Two nearby stereo states give two
   linked rings, and the linking number is the topological invariant.

   This builder reuses the Stokes vector the Poincaré sphere already computes (the
   Bloch point), smoothed across time. The fibre itself is analytic, traced per
   frame in topologies.ts; here we only need the smoothed (s1, s2, s3). Pure. */

export const precomputeHopfSpine = (
    frameCount: number,
    ch0: Float32Array,
    ch1: Float32Array,
    hopSize: number,
    windowSize: number,
    smoothing = 0.3 // EMA weight on each new frame; lower = smoother, more lag
): { spine: Float32Array; normals: Float32Array; binormals: Float32Array } => {
    const spine = new Float32Array(frameCount * 3);
    let e1 = 0;
    let e2 = 0;
    let e3 = 0;
    for (let f = 0; f < frameCount; f++) {
        const { s1, s2, s3 } = stokesVector(ch0, ch1, f * hopSize, windowSize);
        if (f === 0) {
            e1 = s1;
            e2 = s2;
            e3 = s3;
        } else {
            e1 += smoothing * (s1 - e1);
            e2 += smoothing * (s2 - e2);
            e3 += smoothing * (s3 - e3);
        }
        spine[f * 3] = e1; // s1: L/R balance
        spine[f * 3 + 1] = e2; // s2: in-phase correlation
        spine[f * 3 + 2] = e3; // s3: circularity (the Bloch polar axis)
    }
    // The Hopf fibre is analytic in the mapper, so no parallel-transport frames
    // are needed; return empty normal/binormal arrays to match the spine shape.
    return { spine, normals: new Float32Array(frameCount * 3), binormals: new Float32Array(frameCount * 3) };
};
