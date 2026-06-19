/* Topology definitions - the pure geometry behind PhaseScope's four shapes.

   Extracted from usePhaseGeometry so "what the shapes are" lives apart from
   "how they're built". Everything here is a pure function of
   (frameIndex, state, meta): no THREE, no Vue, no engine state - which is why
   the frame mappers can be unit-tested directly (see tests/unit/topologies).

   The engine imports TOPOLOGIES (and these shared types); useAutoCamera reads
   the per-topology orbit params. Nothing in here imports back from the engine,
   so the module stays a leaf. */

export type TopologyMode = 'corridor' | 'sphere' | 'attractor' | 'mobius';

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
    attractorSpine: Float32Array | null;
    attractorNormals: Float32Array | null;
    attractorBinormals: Float32Array | null;
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

const attractorFrameMapper: FrameMapperFactory = (frameIndex, raw) => {
    const { attractorSpine, attractorNormals, attractorBinormals } = raw;
    if (!attractorSpine || !attractorNormals || !attractorBinormals) return null;

    // Spine position and Frenet frame at this frame
    const s = frameIndex * 3;
    const spineX = attractorSpine[s] ?? 0;
    const spineY = attractorSpine[s + 1] ?? 0;
    const spineZ = attractorSpine[s + 2] ?? 0;
    const normX = attractorNormals[s] ?? 0;
    const normY = attractorNormals[s + 1] ?? 0;
    const normZ = attractorNormals[s + 2] ?? 0;
    const binX = attractorBinormals[s] ?? 0;
    const binY = attractorBinormals[s + 1] ?? 0;
    const binZ = attractorBinormals[s + 2] ?? 0;

    const baseTubeRadius = 0.15;
    const audioTubeScale = 0.6;

    return {
        // Tube cross-section: a ring around the spine in its Frenet frame;
        // the radius breathes with audio amplitude
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

interface TopologyDef {
    frameMapper: FrameMapperFactory;
    geometry: {
        pointsPosition: { x: number; y: number; z: number };
        linesPosition: { x: number; y: number; z: number };
    };
    needsAttractorSpine?: boolean;
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
        frameMapper: attractorFrameMapper,
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
        needsAttractorSpine: true,
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
};
