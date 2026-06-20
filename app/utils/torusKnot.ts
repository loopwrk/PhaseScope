import { createSpectralAnalyzer } from '~/utils/audio/analysis';
import { parallelTransportFrames } from '~/utils/spine';

/* Torus knot - the shape of an interval.

   A (p, q) torus knot winds p times around the axis and q times around the
   core; only coprime p, q give a true knot. Simple ratios make simple knots
   (the perfect-fifth-ish 2:3 is the trefoil), busy ratios make tangled ones -
   so the knot's "woundness" reads as the harmonic richness of the music. We
   pick (p, q) from the track's overall brightness (its average spectral
   centroid): brighter, higher material -> a more wound knot. The knot curve is
   the spine; the shared tube machinery wraps it, and the instantaneous
   amplitude makes the tube breathe. Pure: (frameCount, channels, ...) -> arrays. */

// Curated coprime (p, q) pairs, ascending in woundness.
const KNOTS: ReadonlyArray<readonly [number, number]> = [
    [2, 3],
    [2, 5],
    [3, 4],
    [3, 5],
    [2, 7],
    [3, 7],
    [4, 5],
    [5, 6],
];

export const precomputeTorusKnotSpine = (
    frameCount: number,
    ch0: Float32Array,
    ch1: Float32Array,
    hopSize: number,
    windowSize: number,
    sr: number,
    majorRadius = 4,
    minorRadius = 1.4
): { spine: Float32Array; normals: Float32Array; binormals: Float32Array } => {
    // 1. Average brightness over the track -> knot complexity
    const spectral = createSpectralAnalyzer(1024);
    const step = Math.max(1, Math.floor(frameCount / 200)); // ~200 probes is plenty
    let sum = 0;
    let probes = 0;
    for (let f = 0; f < frameCount; f += step) {
        const center = f * hopSize + windowSize / 2;
        sum += spectral.centroid01(ch0, ch1, center - spectral.size / 2, sr);
        probes++;
    }
    const brightness = probes ? sum / probes : 0.5;
    const knot = KNOTS[Math.min(KNOTS.length - 1, Math.max(0, Math.round(brightness * (KNOTS.length - 1))))]!;
    const p = knot[0];
    const q = knot[1];

    // 2. Trace the (p, q) torus knot once over the track
    const spine = new Float32Array(frameCount * 3);
    for (let f = 0; f < frameCount; f++) {
        const t = (f / frameCount) * Math.PI * 2;
        const ring = majorRadius + minorRadius * Math.cos(q * t);
        spine[f * 3] = ring * Math.cos(p * t);
        spine[f * 3 + 1] = minorRadius * Math.sin(q * t); // vertical wobble
        spine[f * 3 + 2] = ring * Math.sin(p * t);
    }

    const { normals, binormals } = parallelTransportFrames(spine, frameCount);
    return { spine, normals, binormals };
};
