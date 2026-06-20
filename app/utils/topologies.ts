/* Topology definitions - the pure geometry behind PhaseScope's five shapes.

   Extracted from usePhaseGeometry so "what the shapes are" lives apart from
   "how they're built". Everything here is a pure function of
   (frameIndex, state, meta): no THREE, no Vue, no engine state - which is why
   the frame mappers can be unit-tested directly (see tests/unit/topologies).

   The engine imports TOPOLOGIES (and these shared types); useAutoCamera reads
   the per-topology orbit params. The two pure spine builders (the Lorenz
   attractor, the Poincaré sphere) are wired in per topology below; those are
   leaf utils too, so the module stays a leaf - nothing imports back from the
   engine. */

import { precomputeAttractorSpine } from '~/utils/attractor';
import { precomputePoincareSpine } from '~/utils/poincare';
import { precomputeTorusKnotSpine } from '~/utils/torusKnot';
import { precomputeHopfSpine } from '~/utils/hopf';

export type TopologyMode =
    | 'corridor'
    | 'sphere'
    | 'attractor'
    | 'mobius'
    | 'poincare'
    | 'harmonics'
    | 'knot'
    | 'helix'
    | 'hopf';

export interface CorridorState {
    buffer: AudioBuffer | null;
    /** Live-input mode: ch0/ch1 are a synth ring buffer, not a track */
    live: boolean;
    sr: number;
    ch0: Float32Array | null;
    ch1: Float32Array | null;
    frameCount: number;
    xyScale: number;
    ringRadius: number;
    builtFrames: number;
    pos: Float32Array | null;
    /** Trajectory topologies (attractor, Poincaré, knot): precomputed spine + tube frames */
    spine: Float32Array | null;
    spineNormals: Float32Array | null;
    spineBinormals: Float32Array | null;
    /** Smoothed per-frame pitch (0..1), for topologies whose shape tracks pitch
     *  (spherical harmonics); precomputed at load. */
    framePitch: Float32Array | null;
}

export interface CorridorMeta {
    zStep: number;
    pointsPerFrame: number;
    windowSize: number;
    hopSize: number;
}

interface FramePoint {
    x: number;
    y: number;
    z: number;
}

interface FrameMapper {
    mapPoint: (u: number, L: number, R: number, normalizedAmp: number) => FramePoint;
}

type FrameMapperFactory = (frameIndex: number, raw: CorridorState, meta: CorridorMeta) => FrameMapper | null;

const corridorFrameMapper: FrameMapperFactory = (frameIndex, raw, meta) => {
    const { frameCount, xyScale, ringRadius } = raw;
    const z0 = (frameIndex - frameCount / 2) * meta.zStep;
    return {
        // Ring + Lissajous portrait: each frame is a "floating wreath" you can
        // walk through; the portrait controls the vertical shape, the ring
        // wraps it, and z0 strings the frames along the time corridor.
        mapPoint: (u, L, R) => ({
            x: Math.cos(u) * ringRadius + L * xyScale,
            y: R * xyScale,
            z: Math.sin(u) * ringRadius + z0,
        }),
    };
};

const sphereFrameMapper: FrameMapperFactory = (frameIndex, raw) => {
    const { frameCount } = raw;
    const baseRadius = 5.0;
    const displacementScale = 1.5;
    // Frame index -> polar angle (phi): time evolves from north to south pole
    const phi = (frameIndex / frameCount) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    return {
        // u is the azimuth; amplitude displaces the surface radially
        mapPoint: (u, _L, _R, normalizedAmp) => {
            const r = baseRadius + normalizedAmp * displacementScale;
            return {
                x: r * sinPhi * Math.cos(u),
                y: r * cosPhi,
                z: r * sinPhi * Math.sin(u),
            };
        },
    };
};

/* Spherical harmonics - the shape of a frequency.

   The sphere's radius is bumped by a sectoral harmonic Y_l^l ~ sin(phi)^l *
   cos(l*theta), which carves 2l lobes around each latitude ring (like the modes
   of a vibrating sphere, or a hydrogen orbital). The mode order l comes from the
   smoothed per-frame pitch, so higher notes bloom more lobes: you watch
   frequency become form. Time runs pole to pole (frameIndex -> latitude); u is
   the azimuth; loudness adds to the displacement. */
const sphericalHarmonicsFrameMapper: FrameMapperFactory = (frameIndex, raw) => {
    const { frameCount, framePitch } = raw;
    const baseRadius = 4.5;
    const lobeDepth = 1.7;
    const ampScale = 1.0;

    const phi = (frameIndex / frameCount) * Math.PI; // polar angle, pole to pole over the track
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const pitch01 = framePitch ? Math.min(1, Math.max(0, framePitch[frameIndex] ?? 0.5)) : 0.5;
    const l = 2 + Math.round(pitch01 * 6); // 2..8 lobed modes from pitch
    // sin(phi)^l concentrates the sectoral lobes at the equator; cap the power so
    // the poles don't go bald at high l.
    const equatorConcentration = Math.pow(sinPhi, Math.min(l, 3));

    return {
        mapPoint: (u, _L, _R, normalizedAmp) => {
            const harmonic = equatorConcentration * Math.cos(l * u); // 2l lobes around the ring
            const r = baseRadius + lobeDepth * harmonic + normalizedAmp * ampScale;
            return {
                x: r * sinPhi * Math.cos(u),
                y: r * cosPhi,
                z: r * sinPhi * Math.sin(u),
            };
        },
    };
};

/* Tube cross-section around a precomputed spine, in its parallel-transport
   frame; the radius breathes with audio amplitude. Shared by every trajectory
   topology - the spine is what differs (a Lorenz orbit, a polarization path),
   not how the tube wraps around it. */
const makeSpineTubeMapper =
    (baseTubeRadius: number, audioTubeScale: number): FrameMapperFactory =>
    (frameIndex, raw) => {
        const { spine, spineNormals, spineBinormals } = raw;
        if (!spine || !spineNormals || !spineBinormals) return null;

        const s = frameIndex * 3;
        const spineX = spine[s] ?? 0;
        const spineY = spine[s + 1] ?? 0;
        const spineZ = spine[s + 2] ?? 0;
        const normX = spineNormals[s] ?? 0;
        const normY = spineNormals[s + 1] ?? 0;
        const normZ = spineNormals[s + 2] ?? 0;
        const binX = spineBinormals[s] ?? 0;
        const binY = spineBinormals[s + 1] ?? 0;
        const binZ = spineBinormals[s + 2] ?? 0;

        return {
            mapPoint: (u, _L, _R, normalizedAmp) => {
                const tubeRadius = baseTubeRadius + normalizedAmp * audioTubeScale;
                const cosU = Math.cos(u);
                const sinU = Math.sin(u);
                return {
                    x: spineX + tubeRadius * (cosU * normX + sinU * binX),
                    y: spineY + tubeRadius * (cosU * normY + sinU * binY),
                    z: spineZ + tubeRadius * (cosU * normZ + sinU * binZ),
                };
            },
        };
    };

// Centreline radius of the Möbius band; shared by the mapper and the head
// anchor so the camera tracks the exact point the geometry wraps around.
const MOBIUS_BAND_RADIUS = 6.0;

const mobiusFrameMapper: FrameMapperFactory = (frameIndex, raw) => {
    const { frameCount, xyScale } = raw;
    const bandRadius = MOBIUS_BAND_RADIUS; // centreline radius of the band
    const ringRadius = 0.35; // skeleton ring so silence still draws the band

    // Time wraps the band in exactly one lap; the cross-section frame
    // rotates by half a turn over that lap. So the final frame arrives at
    // the starting position with its portrait rotated 180 degrees: the
    // track's end meets its beginning as its own polarity-inverse - the
    // same figure, opposed. (A Lissajous portrait rotated by pi is the
    // portrait of the inverted signal: correlation +1 returns as -1.)
    const theta = (frameIndex / frameCount) * Math.PI * 2;
    const twist = theta / 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosW = Math.cos(twist);
    const sinW = Math.sin(twist);
    const centreX = cosT * bandRadius;
    const centreZ = sinT * bandRadius;

    return {
        // Cross-section coordinates (a, b) live in a basis that twists with
        // theta: u-hat = cosW*r-hat + sinW*y-hat, v-hat = -sinW*r-hat + cosW*y-hat,
        // where r-hat is the outward radial direction at this point of the lap.
        mapPoint: (u, L, R) => {
            const a = L * xyScale + Math.cos(u) * ringRadius; // portrait X + ring
            const b = R * xyScale + Math.sin(u) * ringRadius; // portrait Y + ring
            const radial = a * cosW - b * sinW;
            const vertical = a * sinW + b * cosW;
            return {
                x: centreX + radial * cosT,
                y: vertical,
                z: centreZ + radial * sinT,
            };
        },
    };
};

/* Double helix - the shape of a molecule, sequenced by the stereo field.

   A B-DNA double helix: two backbone strands wound around a shared axis (the
   Z axis here, so it builds like the corridor) and joined by base-pair rungs.
   Each frame is one base pair - a step up the helix (rise) rotated by the
   winding (a base twist of ~34 degrees, like real B-DNA). The audio drives the
   biology: the smoothed per-frame pitch over/under-winds the helix locally (a
   supercoiling breath); the instantaneous stereo portrait (L, R) bows each rung
   and left/right imbalance tilts it (propeller twist). And it is SEQUENCED -
   helixFrameHue reads the per-frame stereo quadrant (the signs of the Stokes
   S1/S2) as one of four bases A/C/G/T and colours the base pair by it, so the
   music literally writes a strand.

   The two strands and the rung all live in one ring of points: u is split into
   [strand 1 arc | rung | strand 2 arc], and because each arc spans exactly one
   base-pair step, consecutive frames' arcs tile into two continuous helices as
   the track builds. (Lines mode bridges the three segments, so points mode is
   the honest reading; the corridor is the same way.) */
const HELIX_RADIUS = 1.7; // backbone distance from the axis
const HELIX_RISE = 0.16; // axis advance per base pair (shared with the head anchor)
const HELIX_BASE_TWIST = 0.6; // radians per base pair (~34 deg, B-DNA)
const HELIX_TWIST_WOBBLE = 0.5; // local over/under-wind from pitch (supercoiling)
const HELIX_GROOVE_SPLIT = 2.4; // angle from strand 1 to strand 2 -> major/minor grooves
const HELIX_STRAND_FRAC = 0.34; // share of a frame's ring spent on each backbone arc
const HELIX_LISS = 0.32; // how far the instantaneous (L,R) portrait bows the rung
const HELIX_PROPELLER = 0.5; // stereo imbalance tilts the rung (propeller twist)

// Four-base palette (hue 0..1): A green, T red, G amber, C blue.
const HELIX_BASE_HUES = [0.34, 0.0, 0.12, 0.58];

const helixFrameMapper: FrameMapperFactory = (frameIndex, raw) => {
    const { frameCount, framePitch } = raw;
    const pitch01 = framePitch ? Math.min(1, Math.max(0, framePitch[frameIndex] ?? 0.5)) : 0.5;

    // Winding: a constant base twist plus a local pitch wobble (brighter frames
    // wind a touch tighter), a supercoiling breath rather than a runaway sum.
    const theta0 = HELIX_BASE_TWIST * frameIndex + HELIX_TWIST_WOBBLE * (pitch01 - 0.5);
    const z0 = (frameIndex - frameCount / 2) * HELIX_RISE;

    const strandEnd = HELIX_STRAND_FRAC; // ring fraction where strand 1 ends
    const rungEnd = 1 - HELIX_STRAND_FRAC; // and where the rung ends, strand 2 begins

    // Rung endpoints sit at the mid-height of this base-pair step
    const thetaMid = theta0 + 0.5 * HELIX_BASE_TWIST;
    const theta2Mid = thetaMid + HELIX_GROOVE_SPLIT;
    const zMid = z0 + 0.5 * HELIX_RISE;
    const p1x = Math.cos(thetaMid) * HELIX_RADIUS;
    const p1y = Math.sin(thetaMid) * HELIX_RADIUS;
    const p2x = Math.cos(theta2Mid) * HELIX_RADIUS;
    const p2y = Math.sin(theta2Mid) * HELIX_RADIUS;
    // Outward radial at the rung's centre (in the XY cross-section plane), the
    // axis along which the L channel bows the rung
    const rcx = Math.cos(thetaMid + 0.5 * HELIX_GROOVE_SPLIT);
    const rcy = Math.sin(thetaMid + 0.5 * HELIX_GROOVE_SPLIT);

    return {
        mapPoint: (u, L, R) => {
            const t = u / (Math.PI * 2);
            if (t < strandEnd) {
                // Strand 1 backbone arc for this base-pair step
                const g = t / strandEnd;
                const a = theta0 + g * HELIX_BASE_TWIST;
                return { x: Math.cos(a) * HELIX_RADIUS, y: Math.sin(a) * HELIX_RADIUS, z: z0 + g * HELIX_RISE };
            }
            if (t < rungEnd) {
                // The base-pair rung, carrying the instantaneous stereo portrait.
                // sin(pi*h) pins the bow to zero at both backbones.
                const h = (t - strandEnd) / (rungEnd - strandEnd);
                const bx = p1x + (p2x - p1x) * h;
                const by = p1y + (p2y - p1y) * h;
                const env = Math.sin(Math.PI * h) * HELIX_LISS;
                const propeller = (L - R) * HELIX_PROPELLER * (h - 0.5);
                return { x: bx + rcx * L * env, y: by + rcy * L * env, z: zMid + R * env + propeller };
            }
            // Strand 2 backbone arc (the complementary strand, offset by the groove)
            const g2 = (t - rungEnd) / (1 - rungEnd);
            const a = theta0 + HELIX_GROOVE_SPLIT + g2 * HELIX_BASE_TWIST;
            return { x: Math.cos(a) * HELIX_RADIUS, y: Math.sin(a) * HELIX_RADIUS, z: z0 + g2 * HELIX_RISE };
        },
    };
};

/* Sequence the stereo field into colour. The signs of the Stokes S1 (L/R
   balance) and S2 (in-phase correlation) over the frame's window pick one of
   four quadrants -> one of four bases, and the base pair is coloured by it. So a
   track writes a strand: a left-leaning, correlated passage reads as one base,
   an anti-phase one as another. A strided sum, once per frame - cheap. */
const helixFrameHue = (frameIndex: number, raw: CorridorState, meta: CorridorMeta): number | null => {
    const { ch0, ch1 } = raw;
    if (!ch0 || !ch1 || ch0.length < 2) return null;
    const len = ch0.length;
    const start = (frameIndex * meta.hopSize) % len; // modulo keeps live ring reads in bounds
    let sumL2 = 0;
    let sumR2 = 0;
    let sumLR = 0;
    for (let i = 0; i < meta.windowSize; i += 4) {
        const idx = start + i;
        if (idx >= len) break;
        const L = ch0[idx] ?? 0;
        const R = ch1[idx] ?? 0;
        sumL2 += L * L;
        sumR2 += R * R;
        sumLR += L * R;
    }
    const s1 = sumL2 - sumR2; // L/R balance
    const s2 = 2 * sumLR; // in-phase correlation
    const base = (s1 >= 0 ? 0 : 1) + (s2 >= 0 ? 0 : 2); // 0..3 quadrant -> base
    return HELIX_BASE_HUES[base] ?? 0;
};

/* Hopf fibration - each frame's stereo state, lifted from a point on the Bloch
   (Poincaré) sphere to its whole Hopf fibre: a circle, stereographically
   projected into R^3. The smoothed Stokes vector (precomputed into the spine by
   precomputeHopfSpine) gives the Bloch angles (theta, phi); the ring parameter u
   sweeps the fibre phase xi. Circularity (s3) is the polar axis, so most music -
   low in circularity - sits near the sphere's equator, where the fibres are
   well-proportioned rings; quadrature-heavy passages climb toward a pole and
   their fibres swell (the Villarceau circles near the projection axis). Purity
   (how polarised, i.e. how coherent the stereo) sets the ring's fullness, and
   the live amplitude gives it a gentle shimmer. */
const HOPF_SCALE = 2.6; // base size of the projected fibre rings
const HOPF_MIN_DENOM = 0.2; // clamp the stereographic singularity near the pole

const hopfFrameMapper: FrameMapperFactory = (frameIndex, raw) => {
    const { spine } = raw;
    if (!spine) return null;

    const i = frameIndex * 3;
    const s1 = spine[i] ?? 0;
    const s2 = spine[i + 1] ?? 0;
    const s3 = spine[i + 2] ?? 0;
    const purity = Math.sqrt(s1 * s1 + s2 * s2 + s3 * s3); // degree of polarisation, 0..1

    // Bloch angles from the (smoothed) Stokes vector. A decorrelated frame
    // (purity ~ 0) has no pure state, so default to the equator - it still draws
    // a stable, sensible ring rather than collapsing.
    const nz = purity > 1e-6 ? s3 / purity : 0;
    const theta = Math.acos(Math.min(1, Math.max(-1, nz)));
    const phi = Math.atan2(s2, s1);
    const cosHalf = Math.cos(theta / 2);
    const sinHalf = Math.sin(theta / 2);
    const ringScale = HOPF_SCALE * (0.5 + 0.5 * purity); // coherent stereo -> fuller ring

    return {
        // u is the fibre phase xi. (cosHalf*e^{i xi}, sinHalf*e^{i(xi+phi)}) is a
        // point on S^3 whose Hopf image is this frame's Bloch point for every xi;
        // stereographic projection from the x4 = 1 pole turns the fibre into a
        // circle in R^3. The axis map (x1,x3,x2) -> (x,y,z) stands the nested
        // tori upright around Y.
        mapPoint: (u, _L, _R, normalizedAmp) => {
            const x1 = cosHalf * Math.cos(u);
            const x2 = cosHalf * Math.sin(u);
            const x3 = sinHalf * Math.cos(u + phi);
            const x4 = sinHalf * Math.sin(u + phi);
            const denom = Math.max(HOPF_MIN_DENOM, 1 - x4);
            const k = (ringScale * (1 + normalizedAmp * 0.12)) / denom;
            return { x: x1 * k, y: x3 * k, z: x2 * k };
        },
    };
};

/* ---------- Head anchors ----------
   Where the corridor "head" (the most recently built frame's centre) sits in
   object space, per head-anchored topology. The camera follows this point and
   the touch orbit targets it, so the view tracks the geometry as it grows.
   Pure like the mappers; channel-bias adjustment (corridor only) is applied by
   the engine, which owns that reactive state. */

type HeadAnchorFn = (frameIndex: number, raw: CorridorState, meta: CorridorMeta) => FramePoint;

// Corridor: frames stack along Z, centred on the origin.
const corridorHeadAnchor: HeadAnchorFn = (frameIndex, raw, meta) => ({
    x: 0,
    y: 0,
    z: (frameIndex - raw.frameCount / 2) * meta.zStep,
});

// Möbius: the head travels the band's centreline, one full lap over the track.
const mobiusHeadAnchor: HeadAnchorFn = (frameIndex, raw) => {
    const theta = (frameIndex / raw.frameCount) * Math.PI * 2;
    return { x: Math.cos(theta) * MOBIUS_BAND_RADIUS, y: 0, z: Math.sin(theta) * MOBIUS_BAND_RADIUS };
};

// Double helix: the head climbs the axis (Z) with the build, like the corridor.
const helixHeadAnchor: HeadAnchorFn = (frameIndex, raw) => ({
    x: 0,
    y: 0,
    z: (frameIndex - raw.frameCount / 2) * HELIX_RISE,
});

/* ---------- Topology registry ----------
   Single home for everything that varies per topology: the frame mapper,
   the renderer's object-space offsets, whether the Lorenz spine must be
   pre-computed at load, and the auto-orbit camera parameters (corridor's
   head-relative orbit/follow cameras are bespoke, so it has no entry). */

export interface OrbitParams {
    radius: number;
    speed: number;
    elevCosFreq: number;
    elevCosAmp: number;
    elevSinFreq: number;
    elevSinAmp: number;
    wobbleFreq: number;
    wobbleAmp: number;
}

/** A precomputed spine plus its tube frames, for trajectory topologies. */
export interface SpineFrames {
    spine: Float32Array;
    normals: Float32Array;
    binormals: Float32Array;
}

/** Builds a topology's spine at audio-load time from the decoded channels.
 *  Modular and optional: a topology sets this only if it needs a spine, and the
 *  engine just calls it - no per-topology special-casing in the build. */
export type SpineBuilder = (args: {
    frameCount: number;
    ch0: Float32Array;
    ch1: Float32Array;
    hopSize: number;
    windowSize: number;
    sr: number;
}) => SpineFrames;

interface TopologyDef {
    frameMapper: FrameMapperFactory;
    geometry: {
        pointsPosition: { x: number; y: number; z: number };
        linesPosition: { x: number; y: number; z: number };
    };
    /** Precompute a spine at load (attractor, Poincaré, knot); the engine stores
     *  the result in CorridorState.spine/spineNormals/spineBinormals. */
    buildSpine?: SpineBuilder;
    /** Precompute a smoothed per-frame pitch array at load (spherical harmonics,
     *  double helix); the engine stores it in CorridorState.framePitch. */
    needsFramePitch?: boolean;
    /** Optional per-frame hue (0..1) that overrides the centroid colour; returns
     *  null to fall back. Lets a topology encode an identity in colour - the
     *  double helix's base sequence. Modular: only set where it means something. */
    frameHue?: (frameIndex: number, raw: CorridorState, meta: CorridorMeta) => number | null;
    orbit?: OrbitParams;
    /** Camera follows the head (corridor, Möbius) instead of orbiting the
     *  centre; the engine/camera read headAnchor for the head's position. */
    anchorOnHead?: boolean;
    headAnchor?: HeadAnchorFn;
}

export const TOPOLOGIES: Record<TopologyMode, TopologyDef> = {
    corridor: {
        frameMapper: corridorFrameMapper,
        // Corridor extends along Z; sphere and attractor are centred at origin
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0.95 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        anchorOnHead: true,
        headAnchor: corridorHeadAnchor,
    },
    sphere: {
        frameMapper: sphereFrameMapper,
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        orbit: {
            radius: 12,
            speed: 0.2,
            elevCosFreq: 0.13,
            elevCosAmp: 1.22,
            elevSinFreq: 0.37,
            elevSinAmp: 0.35,
            wobbleFreq: 0.53,
            wobbleAmp: 1.5,
        },
    },
    attractor: {
        frameMapper: makeSpineTubeMapper(0.15, 0.6),
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        buildSpine: ({ frameCount, ch0, hopSize }) => precomputeAttractorSpine(frameCount, ch0, hopSize),
        // Wider, slower drift than the sphere to show the full butterfly
        orbit: {
            radius: 16,
            speed: 0.12,
            elevCosFreq: 0.17,
            elevCosAmp: 0.9,
            elevSinFreq: 0.41,
            elevSinAmp: 0.3,
            wobbleFreq: 0.47,
            wobbleAmp: 2.5,
        },
    },
    mobius: {
        frameMapper: mobiusFrameMapper,
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        // Like the corridor, the camera rides the head as it laps the band
        // rather than orbiting the band's centre.
        anchorOnHead: true,
        headAnchor: mobiusHeadAnchor,
    },
    poincare: {
        // The stereo field's polarization, traced on the Poincaré sphere: a thin
        // tube following the Stokes-vector path over a sphere of pure stereo
        // states. Centred at the origin, so the camera orbits the sphere.
        frameMapper: makeSpineTubeMapper(0.1, 0.5),
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        buildSpine: ({ frameCount, ch0, ch1, hopSize, windowSize }) =>
            precomputePoincareSpine(frameCount, ch0, ch1, hopSize, windowSize),
        orbit: {
            radius: 12,
            speed: 0.18,
            elevCosFreq: 0.13,
            elevCosAmp: 1.1,
            elevSinFreq: 0.37,
            elevSinAmp: 0.35,
            wobbleFreq: 0.5,
            wobbleAmp: 1.5,
        },
    },
    harmonics: {
        // A vibrating-sphere bloom: pitch sets the lobe count, loudness the depth.
        frameMapper: sphericalHarmonicsFrameMapper,
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        needsFramePitch: true,
        orbit: {
            radius: 13,
            speed: 0.17,
            elevCosFreq: 0.15,
            elevCosAmp: 1.15,
            elevSinFreq: 0.39,
            elevSinAmp: 0.33,
            wobbleFreq: 0.5,
            wobbleAmp: 1.8,
        },
    },
    knot: {
        // A (p,q) torus knot whose woundness is the track's harmonic richness;
        // a tube follows the knot, breathing with amplitude.
        frameMapper: makeSpineTubeMapper(0.22, 0.55),
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        buildSpine: ({ frameCount, ch0, ch1, hopSize, windowSize, sr }) =>
            precomputeTorusKnotSpine(frameCount, ch0, ch1, hopSize, windowSize, sr),
        orbit: {
            radius: 13,
            speed: 0.16,
            elevCosFreq: 0.16,
            elevCosAmp: 1.0,
            elevSinFreq: 0.4,
            elevSinAmp: 0.34,
            wobbleFreq: 0.48,
            wobbleAmp: 2.0,
        },
    },
    helix: {
        // A B-DNA double helix: two strands + base-pair rungs, wound by pitch,
        // bowed by the stereo portrait, and sequenced into A/C/G/T by colour.
        // Head-anchored like the corridor, so the camera climbs the strand.
        frameMapper: helixFrameMapper,
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        needsFramePitch: true,
        frameHue: helixFrameHue,
        anchorOnHead: true,
        headAnchor: helixHeadAnchor,
    },
    hopf: {
        // Each frame's stereo state lifted off the Bloch/Poincaré sphere into its
        // Hopf fibre - a ring - and the track threads the rings into nested,
        // linked Villarceau circles. Reuses the Stokes vector via the spine;
        // centred at the origin, so the camera orbits the structure.
        frameMapper: hopfFrameMapper,
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        buildSpine: ({ frameCount, ch0, ch1, hopSize, windowSize }) =>
            precomputeHopfSpine(frameCount, ch0, ch1, hopSize, windowSize),
        orbit: {
            radius: 15,
            speed: 0.15,
            elevCosFreq: 0.13,
            elevCosAmp: 1.1,
            elevSinFreq: 0.37,
            elevSinAmp: 0.35,
            wobbleFreq: 0.5,
            wobbleAmp: 2.0,
        },
    },
};
