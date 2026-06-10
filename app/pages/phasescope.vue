<script setup lang="ts">
import * as THREE from 'three';
import { toRaw } from 'vue';
import {
    analyzeFrequencyBand,
    analyzeLocalFrequency,
    freqContentToHz,
    ampToOscillationRange,
} from '~/utils/audio/analysis';
import type { RenderMode } from '~/composables/useCorridorRenderer.client';
import { useNarrativeTransform } from '~/composables/experimental/useNarrativeTransform';
import { useMediaQuery, useIntervalFn } from '@vueuse/core';

// Full-bleed canvas dashboard - opt out of the default site chrome (header /
// container / footer); this page paints the whole viewport itself.
definePageMeta({ layout: false });

// Desktop shows the side panels by default; phones start with them collapsed
// (they overlay the canvas) and the user opens them from the header.
const isDesktop = useMediaQuery('(min-width: 768px)');

interface CorridorState {
    buffer: AudioBuffer | null;
    sr: number;
    ch0: Float32Array | null;
    ch1: Float32Array | null;
    frameCount: number;
    xyScale: number;
    ringRadius: number;
    builtFrames: number;
    pos: Float32Array | null;
    frequencies: Float32Array | null;
    amplitudes: Float32Array | null;
    anchorPositions: Float32Array | null;
    attractorSpine: Float32Array | null;
    attractorNormals: Float32Array | null;
    attractorBinormals: Float32Array | null;
}

const renderMode = ref<RenderMode>('points');

const canvasContainer = ref<HTMLDivElement | null>(null);
const three = useThree(canvasContainer);
const scene = three.scene;

// Initialize corridor renderer
const renderer = useCorridorRenderer(scene);

// Dream background variants — mutually exclusive
const dreamBg = useDreamBackground(scene);
const heavenlyBg = useHeavenlyBackground(scene);

type CameraMode = 'free' | 'follow' | 'orbit';
const cameraMode = ref<CameraMode>('orbit');

type TopologyMode = 'corridor' | 'sphere' | 'attractor';
const topologyMode = ref<TopologyMode>('corridor');

const { show: showToast } = usePsToast();

// Demo tracks
const { tracks: demoTracks, loadDemoTrack, isLoading: demoTracksLoading } = useDemoTracks();
const sortedDemoTracks = computed(() => {
    const orderKey = topologyMode.value === 'sphere' ? 'sphereOrder' : 'corridorOrder';
    return [...demoTracks.value].sort((a, b) => a[orderKey] - b[orderKey]);
});

const movement = useKeyboardMovement(three.controls, {
    onMovement: () => {
        cameraMode.value = 'free';
    },
});

usePointerLockCamera(three.controls, canvasContainer, {
    onLock: () => {
        // Disable auto-follow when user takes manual camera control
        cameraMode.value = 'free';
    },
});

let requestAnimFrame: number | null = null;

const initaliseScene = () => {
    three.init();
};

const sphereOrbitStartTime = ref(0);

const applyTopologyCameraDefaults = () => {
    cameraMode.value = 'orbit';
};

// Initialize WAV player composable
const {
    audio,
    wavLoaded,
    loadWavFile: loadWavFileBase,
    startAudio,
    stopAllAudio,
    pauseAudio,
    resumeAudio,
    getPlaybackTimeSeconds,
    onTrackEnded,
    dispose: disposeWavPlayer,
} = useWavPlayer();

const corridorState = ref<CorridorState>({
    buffer: null,
    sr: 0,
    ch0: null,
    ch1: null,
    frameCount: 0,
    xyScale: 1.8,
    ringRadius: 1.8,
    builtFrames: 0,
    pos: null,
    frequencies: null,
    amplitudes: null,
    anchorPositions: null,
    attractorSpine: null,
    attractorNormals: null,
    attractorBinormals: null,
});

const { narrativeEnabled, narrativeAutoStage, narrativeStage, narrativeHandedBias, applyNarrativeTransform } =
    useNarrativeTransform(corridorState);

// Initialize oscillation composable
const oscillation = useOscillation({
    onUpdate: () => renderer.markGeometryForUpdate(true, false),
});

const showControlsOverlay = ref(true);
const showSettings = ref(true);
const advancedOptionsOpen = ref(false);

// Floating side panels: both open on desktop, both collapsed on phones (they
// overlay the canvas). Crossing the breakpoint resets them. `immediate` means
// this also sets the correct initial state (isDesktop is false during SSR /
// first paint, so phones start collapsed without depending on mount timing).
watch(
    isDesktop,
    (desktop) => {
        showControlsOverlay.value = desktop;
        showSettings.value = desktop;
    },
    { immediate: true }
);

// On phones the two panels are mutually exclusive so they never stack.
const toggleControls = () => {
    showControlsOverlay.value = !showControlsOverlay.value;
    if (!isDesktop.value && showControlsOverlay.value) showSettings.value = false;
};
const toggleSettings = () => {
    showSettings.value = !showSettings.value;
    if (!isDesktop.value && showSettings.value) showControlsOverlay.value = false;
};

// Elapsed-time readout for the transport dock. UI-only: polls the player
// clock at 2Hz, which is plenty for a mm:ss display and never touches the
// audio engine itself.
const elapsedLabel = ref('00:00');
useIntervalFn(() => {
    const t = wavLoaded.value ? Math.max(0, getPlaybackTimeSeconds()) : 0;
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(Math.floor(t % 60)).padStart(2, '0');
    elapsedLabel.value = `${m}:${s}`;
}, 500);
const useAlternateColors = ref(false);

// Track coverage as percentage (0-100)
const trackCoveragePercent = ref(100);

const corridorMeta = ref({
    zStep: 0.08, // distance between frames along Z axis
    pointsPerFrame: 512,
    windowSize: 2048, // samples per frame window
    hopSize: 1024, // samples between frames
});

// Performance warning thresholds
const POINTS_WARNING_THRESHOLD = 3_000_000;
const POINTS_DANGER_THRESHOLD = 8_000_000;

// Calculate total frames possible for the loaded audio
const totalFramesForTrack = computed(() => {
    if (!audio.buffer) return 0;
    const { windowSize, hopSize } = corridorMeta.value;
    return Math.max(0, Math.floor((audio.buffer.length - windowSize) / hopSize));
});

// Calculate total points needed for full track at current pointsPerFrame
const totalPointsForFullTrack = computed(() => {
    return totalFramesForTrack.value * corridorMeta.value.pointsPerFrame;
});

// Calculate effective max points based on percentage slider
const effectiveMaxPoints = computed(() => {
    const fullPoints = totalPointsForFullTrack.value;
    return Math.floor(fullPoints * (trackCoveragePercent.value / 100));
});

// Warning level: 'none' | 'warning' | 'danger'
const pointsWarningLevel = computed(() => {
    const points = effectiveMaxPoints.value;
    if (points >= POINTS_DANGER_THRESHOLD) return 'danger';
    if (points >= POINTS_WARNING_THRESHOLD) return 'warning';
    return 'none';
});

// Format large numbers for display
const formatPointCount = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
    return count.toString();
};

const clearCorridor = () => {
    renderer.clearGeometry();
    corridorState.value.buffer = null;
    corridorState.value.sr = 0;
    corridorState.value.ch0 = null;
    corridorState.value.ch1 = null;
    corridorState.value.frameCount = 0;
    corridorState.value.builtFrames = 0;
    corridorState.value.pos = null;
    corridorState.value.frequencies = null;
    corridorState.value.amplitudes = null;
    corridorState.value.anchorPositions = null;
    corridorState.value.attractorSpine = null;
    corridorState.value.attractorNormals = null;
    corridorState.value.attractorBinormals = null;
};

const precomputeAttractorSpine = (
    frameCount: number,
    ch0: Float32Array,
    hopSize: number
): { spine: Float32Array; normals: Float32Array; binormals: Float32Array } => {
    const σ = 10,
        β = 8 / 3;
    const ρMin = 25,
        ρMax = 38;
    const dt = 0.01;
    const stepsPerFrame = 4;

    // 1. Compute RMS amplitude envelope per frame
    const envelope = new Float32Array(frameCount);
    let maxEnv = 0;
    for (let f = 0; f < frameCount; f++) {
        const start = f * hopSize;
        const end = Math.min(start + hopSize, ch0.length);
        let sum = 0;
        for (let i = start; i < end; i++) {
            const s = ch0[i] ?? 0;
            sum += s * s;
        }
        envelope[f] = Math.sqrt(sum / Math.max(1, end - start));
        if ((envelope[f] ?? 0) > maxEnv) maxEnv = envelope[f] ?? 0;
    }
    if (maxEnv < 0.0001) maxEnv = 0.0001;

    // 2. Warm-up: integrate 5000 steps to settle onto attractor
    let x = 0.1,
        y = 0.0,
        z = 0.0;
    for (let s = 0; s < 5000; s++) {
        const k1x = σ * (y - x),
            k1y = x * (ρMin - z) - y,
            k1z = x * y - β * z;
        const x2 = x + 0.5 * dt * k1x,
            y2 = y + 0.5 * dt * k1y,
            z2 = z + 0.5 * dt * k1z;
        const k2x = σ * (y2 - x2),
            k2y = x2 * (ρMin - z2) - y2,
            k2z = x2 * y2 - β * z2;
        const x3 = x + 0.5 * dt * k2x,
            y3 = y + 0.5 * dt * k2y,
            z3 = z + 0.5 * dt * k2z;
        const k3x = σ * (y3 - x3),
            k3y = x3 * (ρMin - z3) - y3,
            k3z = x3 * y3 - β * z3;
        const x4 = x + dt * k3x,
            y4 = y + dt * k3y,
            z4 = z + dt * k3z;
        const k4x = σ * (y4 - x4),
            k4y = x4 * (ρMin - z4) - y4,
            k4z = x4 * y4 - β * z4;
        x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
        y += (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
        z += (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
    }

    // 3. Integrate trajectory, modulating ρ by the amplitude envelope
    const spine = new Float32Array(frameCount * 3);
    for (let f = 0; f < frameCount; f++) {
        const ρ = ρMin + clamp((envelope[f] ?? 0) / maxEnv, 0, 1) * (ρMax - ρMin);
        for (let s = 0; s < stepsPerFrame; s++) {
            const k1x = σ * (y - x),
                k1y = x * (ρ - z) - y,
                k1z = x * y - β * z;
            const x2 = x + 0.5 * dt * k1x,
                y2 = y + 0.5 * dt * k1y,
                z2 = z + 0.5 * dt * k1z;
            const k2x = σ * (y2 - x2),
                k2y = x2 * (ρ - z2) - y2,
                k2z = x2 * y2 - β * z2;
            const x3 = x + 0.5 * dt * k2x,
                y3 = y + 0.5 * dt * k2y,
                z3 = z + 0.5 * dt * k2z;
            const k3x = σ * (y3 - x3),
                k3y = x3 * (ρ - z3) - y3,
                k3z = x3 * y3 - β * z3;
            const x4 = x + dt * k3x,
                y4 = y + dt * k3y,
                z4 = z + dt * k3z;
            const k4x = σ * (y4 - x4),
                k4y = x4 * (ρ - z4) - y4,
                k4z = x4 * y4 - β * z4;
            x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
            y += (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
            z += (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
        }
        spine[f * 3] = x;
        spine[f * 3 + 1] = y;
        spine[f * 3 + 2] = z;
    }

    // 4. Center and scale to fit scene (diameter 12 → radius 6)
    let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
    for (let f = 0; f < frameCount; f++) {
        const fx = spine[f * 3] ?? 0,
            fy = spine[f * 3 + 1] ?? 0,
            fz = spine[f * 3 + 2] ?? 0;
        if (fx < minX) minX = fx;
        if (fx > maxX) maxX = fx;
        if (fy < minY) minY = fy;
        if (fy > maxY) maxY = fy;
        if (fz < minZ) minZ = fz;
        if (fz > maxZ) maxZ = fz;
    }
    const cx = (minX + maxX) / 2,
        cy = (minY + maxY) / 2,
        cz = (minZ + maxZ) / 2;
    const maxExtent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const scale = maxExtent > 0 ? 12 / maxExtent : 1;
    for (let f = 0; f < frameCount; f++) {
        spine[f * 3] = ((spine[f * 3] ?? 0) - cx) * scale;
        spine[f * 3 + 1] = ((spine[f * 3 + 1] ?? 0) - cy) * scale;
        spine[f * 3 + 2] = ((spine[f * 3 + 2] ?? 0) - cz) * scale;
    }

    // 5. Compute Frenet frames via parallel transport (avoids degenerate normals at inflection points)
    const normals = new Float32Array(frameCount * 3);
    const binormals = new Float32Array(frameCount * 3);

    // Initial tangent T0 = normalize(P1 - P0)
    let tx = (spine[3] ?? 0) - (spine[0] ?? 0),
        ty = (spine[4] ?? 0) - (spine[1] ?? 0),
        tz = (spine[5] ?? 0) - (spine[2] ?? 0);
    let tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (tlen < 1e-10) tlen = 1;
    tx /= tlen;
    ty /= tlen;
    tz /= tlen;

    // Initial normal via Gram-Schmidt with an arbitrary reference vector
    let ax = 0,
        ay = 1,
        az = 0;
    if (Math.abs(ty) > 0.9) {
        ax = 1;
        ay = 0;
    }
    const d0 = ax * tx + ay * ty + az * tz;
    ax -= d0 * tx;
    ay -= d0 * ty;
    az -= d0 * tz;
    let nlen = Math.sqrt(ax * ax + ay * ay + az * az);
    if (nlen < 1e-10) nlen = 1;
    let nx = ax / nlen,
        ny = ay / nlen,
        nz = az / nlen;
    let bx = ty * nz - tz * ny,
        by = tz * nx - tx * nz,
        bz = tx * ny - ty * nx;
    normals[0] = nx;
    normals[1] = ny;
    normals[2] = nz;
    binormals[0] = bx;
    binormals[1] = by;
    binormals[2] = bz;

    for (let f = 1; f < frameCount; f++) {
        const pi = f * 3,
            pp = (f - 1) * 3;
        let ntx = (spine[pi] ?? 0) - (spine[pp] ?? 0),
            nty = (spine[pi + 1] ?? 0) - (spine[pp + 1] ?? 0),
            ntz = (spine[pi + 2] ?? 0) - (spine[pp + 2] ?? 0);
        let ntlen = Math.sqrt(ntx * ntx + nty * nty + ntz * ntz);
        if (ntlen < 1e-10) ntlen = 1;
        ntx /= ntlen;
        nty /= ntlen;
        ntz /= ntlen;

        // Rotation axis = T × T_new (parallel transport step)
        const rax = ty * ntz - tz * nty,
            ray = tz * ntx - tx * ntz,
            raz = tx * nty - ty * ntx;
        const raLen = Math.sqrt(rax * rax + ray * ray + raz * raz);
        if (raLen > 1e-8) {
            const rnx = rax / raLen,
                rny = ray / raLen,
                rnz = raz / raLen;
            const cosA = clamp(tx * ntx + ty * nty + tz * ntz, -1, 1);
            const sinA = raLen;
            const rdot = rnx * nx + rny * ny + rnz * nz;
            const crossX = rny * nz - rnz * ny,
                crossY = rnz * nx - rnx * nz,
                crossZ = rnx * ny - rny * nx;
            nx = nx * cosA + crossX * sinA + rnx * rdot * (1 - cosA);
            ny = ny * cosA + crossY * sinA + rny * rdot * (1 - cosA);
            nz = nz * cosA + crossZ * sinA + rnz * rdot * (1 - cosA);
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (nl > 1e-10) {
                nx /= nl;
                ny /= nl;
                nz /= nl;
            }
        }
        bx = nty * nz - ntz * ny;
        by = ntz * nx - ntx * nz;
        bz = ntx * ny - nty * nx;
        normals[f * 3] = nx;
        normals[f * 3 + 1] = ny;
        normals[f * 3 + 2] = nz;
        binormals[f * 3] = bx;
        binormals[f * 3 + 1] = by;
        binormals[f * 3 + 2] = bz;
        tx = ntx;
        ty = nty;
        tz = ntz;
    }

    return { spine, normals, binormals };
};

const initLiveSnapshotCorridor = (buffer: AudioBuffer) => {
    clearCorridor();

    const sr = buffer.sampleRate;
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;

    const { windowSize, hopSize, pointsPerFrame } = corridorMeta.value;
    const totalFrames = Math.floor((ch0.length - windowSize) / hopSize);

    // Calculate max frames based on percentage-based point budget
    // Use buffer directly here to avoid reactivity timing issues with computed properties
    const totalPointsForBuffer = totalFrames * pointsPerFrame;
    const maxPointsForCoverage = Math.floor(totalPointsForBuffer * (trackCoveragePercent.value / 100));
    const maxFrames = Math.floor(maxPointsForCoverage / pointsPerFrame);
    const frameCount = Math.max(1, Math.min(totalFrames, maxFrames));

    corridorState.value.buffer = buffer;
    corridorState.value.sr = sr;
    corridorState.value.ch0 = ch0;
    corridorState.value.ch1 = ch1;
    corridorState.value.frameCount = frameCount;
    corridorState.value.builtFrames = 0;

    const totalPoints = frameCount * pointsPerFrame;

    // Allocate oscillation data arrays
    const frequencies = new Float32Array(totalPoints);
    const amplitudes = new Float32Array(totalPoints);
    const anchorPositions = new Float32Array(totalPoints * 3);

    corridorState.value.frequencies = frequencies;
    corridorState.value.amplitudes = amplitudes;
    corridorState.value.anchorPositions = anchorPositions;

    const topology = TOPOLOGIES[topologyMode.value];

    // Attractor topology: pre-compute Lorenz spine and Frenet frames at load time
    if (topology.needsAttractorSpine) {
        const { spine, normals, binormals } = precomputeAttractorSpine(frameCount, ch0, hopSize);
        corridorState.value.attractorSpine = spine;
        corridorState.value.attractorNormals = normals;
        corridorState.value.attractorBinormals = binormals;
    }

    // Create geometries using the renderer, at the topology's object-space offsets
    const { positions } = renderer.createGeometry({
        totalPoints,
        renderMode,
        ...topology.geometry,
    });

    corridorState.value.pos = positions;
};

const loadWavFile = async (file: File) => {
    stopAllAudio();
    clearCorridor();

    await loadWavFileBase(file);

    // Build the 3D snapshot corridor progressively as playback advances
    if (audio.buffer) {
        initLiveSnapshotCorridor(audio.buffer);
    }

    sphereOrbitStartTime.value = performance.now() / 1000;

    // Position camera based on topology mode
    if (topologyMode.value === 'sphere') {
        const camObj = three.controls.value?.object;
        if (camObj) {
            // Start above the north pole before orbiting
            const galleryY = 1.7;
            const baseRadius = 5.0;
            camObj.position.set(0, galleryY + baseRadius + 6, 0);
            three.camera.value?.lookAt(0, galleryY, 0);
        }
        // Exit pointer lock so camera can orbit smoothly
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        applyTopologyCameraDefaults();
    } else {
        applyTopologyCameraDefaults();
    }
};

const handleLoadDemoTrack = async (trackId: string): Promise<boolean> => {
    const track = sortedDemoTracks.value.find((t) => t.id === trackId);
    if (!track) return false;

    const trackIndex = sortedDemoTracks.value.indexOf(track);
    if (trackIndex !== -1) autoPlayIndex.value = trackIndex;

    demoTracksLoading.value = true;
    try {
        const file = await loadDemoTrack(track);
        await loadWavFile(file);
        return true;
    } catch (error) {
        showToast('error', 'Failed to load demo track', error instanceof Error ? error.message : 'Unknown error');
        return false;
    } finally {
        demoTracksLoading.value = false;
    }
};

const onAudioLoadError = (error: Error) => {
    showToast('error', 'Failed to load audio', error.message);
};

const handlePlay = async () => {
    // If paused (started but no active source), resume from saved position
    if (audio.started && !audio.source) {
        await resumeAudio();
    } else {
        // Fresh playback - always re-initialize corridor to ensure arrays
        // are sized correctly for current settings (pointsPerFrame, trackCoverage, etc.)
        if (audio.buffer) {
            initLiveSnapshotCorridor(audio.buffer);
            applyTopologyCameraDefaults();
        }
        await startAudio();
    }
};

const handlePause = () => {
    pauseAudio();
};

const handlePlayPause = async () => {
    if (audio.source) {
        handlePause();
    } else {
        await handlePlay();
    }
};

const handleStop = () => {
    stopAllAudio();
    clearCorridor();
};

// Auto-play: play tracks sequentially, looping back to start
const autoPlayIndex = ref(-1);
const selectedDemoTrackId = computed(() =>
    autoPlayIndex.value >= 0 ? (sortedDemoTracks.value[autoPlayIndex.value]?.id ?? null) : null
);

const playAutoTrackAtIndex = async (index: number) => {
    const tracks = sortedDemoTracks.value;
    const track = tracks[index];
    if (!track) return;
    autoPlayIndex.value = index;
    const loaded = await handleLoadDemoTrack(track.id);
    if (!loaded) return;
    await handlePlay();
};

const handleSelectDemoTrack = (trackId: string) => {
    const index = sortedDemoTracks.value.findIndex((t) => t.id === trackId);
    if (index !== -1) void playAutoTrackAtIndex(index);
};

// Step to the next (+1) or previous (-1) demo track, wrapping at the ends.
// Shared by the { } shortcuts, hardware media keys, and auto-advance.
const playAdjacentTrack = (direction: 1 | -1) => {
    const count = sortedDemoTracks.value.length;
    if (count === 0) return;
    const index = (autoPlayIndex.value + direction + count) % count;
    void playAutoTrackAtIndex(index);
};

onTrackEnded(() => {
    // Only auto-advance if a demo track was playing (not a user-loaded file)
    if (autoPlayIndex.value < 0) return;
    playAdjacentTrack(1);
});

const getTargetFrameForPlayback = () => {
    // Map playback time to a frame index.
    if (!corridorState.value.buffer) return 0;
    const t = getPlaybackTimeSeconds();
    const sr = corridorState.value.sr;
    const sample = Math.floor(t * sr);

    const { windowSize, hopSize } = corridorMeta.value;
    // frame 0 corresponds to window starting at sample 0
    const f = Math.floor((sample - windowSize) / hopSize);
    return clamp(f, 0, Math.max(0, corridorState.value.frameCount - 1));
};

/* ---------- Frame building (shared pipeline + per-topology mappers) ----------

   Every topology builds a frame the same way: slice the stereo buffer,
   analyse the frame's frequency content once (drives the hue), then for
   each point derive L/R + amplitude, place the point with the topology's
   mapper, run the narrative transform, and write position / colour /
   oscillation data / anchors. Only the point placement differs, so each
   topology contributes a frame-mapper factory: per-frame setup (guards +
   precomputed values) returning a per-point mapPoint(). Adding a topology
   = one factory + one TOPOLOGIES entry. */

interface FramePoint {
    x: number;
    y: number;
    z: number;
}

interface FrameMapper {
    /** Narrative-transform z anchor (corridor backbone z; 0 elsewhere) */
    z0: number;
    mapPoint: (u: number, L: number, R: number, normalizedAmp: number) => FramePoint;
}

type FrameMapperFactory = (frameIndex: number, raw: CorridorState) => FrameMapper | null;

const corridorFrameMapper: FrameMapperFactory = (frameIndex, raw) => {
    const { zStep } = corridorMeta.value;
    const { frameCount, xyScale, ringRadius } = raw;
    const z0 = (frameIndex - frameCount / 2) * zStep;
    return {
        z0,
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
        z0: 0,
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
        z0: 0,
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

/* ---------- Topology registry ----------
   Single home for everything that varies per topology: the frame mapper,
   the renderer's object-space offsets, whether the Lorenz spine must be
   pre-computed at load, and the auto-orbit camera parameters (corridor's
   head-relative orbit/follow cameras are bespoke, so it has no entry). */

interface OrbitParams {
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
}

const TOPOLOGIES: Record<TopologyMode, TopologyDef> = {
    corridor: {
        frameMapper: corridorFrameMapper,
        // Corridor extends along Z; sphere and attractor are centred at origin
        geometry: { pointsPosition: { x: 0, y: 1.7, z: 0.95 }, linesPosition: { x: 0, y: 1.7, z: 0 } },
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
};

const buildOneFrame = (frameIndex: number) => {
    // Writes a single frame into the preallocated position/colour buffers.
    const { pointsPerFrame, windowSize, hopSize } = corridorMeta.value;
    // Use toRaw to ensure we write to the actual Float32Arrays, not Vue proxies
    const rawState = toRaw(corridorState.value);
    const { ch0, ch1, frameCount, pos, frequencies, amplitudes, anchorPositions } = rawState;
    if (!pos || !ch0 || !ch1 || !renderer.hasGeometry()) return;
    if (!frequencies || !amplitudes || !anchorPositions) return;

    const frame = TOPOLOGIES[topologyMode.value].frameMapper(frameIndex, rawState);
    if (!frame) return;

    const frameStart = frameIndex * hopSize;

    // Each frame occupies a contiguous block.
    let p = frameIndex * pointsPerFrame * 3;
    const colors = renderer.getColorArray();
    if (!colors) return;

    // Reuse a single Color object to avoid allocating one per point
    const color = new THREE.Color();

    // Precompute frequency analysis once per frame (at frame centre): frequency
    // content doesn't change meaningfully within one frame's window (~23ms)
    const analysisWindow = 4096; // fixed size for a good frequency/time balance
    const frameCenterSample = clamp(frameStart + windowSize / 2, 0, ch0.length - 1);
    const windowStart = Math.max(0, frameCenterSample - analysisWindow / 2);
    const freqL = analyzeFrequencyBand(ch0, windowStart, analysisWindow);
    const freqR = analyzeFrequencyBand(ch1, windowStart, analysisWindow);
    const freqContent = (freqL + freqR) / 2; // 0 = low freq, 1 = high freq

    // Hue from frequency (same for all points in the frame)
    // Default:  bass (0) = BLUE/MAGENTA -> treble (1) = RED; reverse flips it
    const hueRangeMultiplier = 0.75;
    const hue = useAlternateColors.value
        ? freqContent * hueRangeMultiplier
        : hueRangeMultiplier - freqContent * hueRangeMultiplier;
    const baseSaturation = 0.92;
    const baseLightness = 0.35;
    const amplitudeBrightnessFactor = 0.35;

    for (let k = 0; k < pointsPerFrame; k++) {
        const u = (k / pointsPerFrame) * Math.PI * 2;
        const sampleIndex = frameStart + Math.floor((k / pointsPerFrame) * windowSize);
        const i = clamp(sampleIndex, 0, ch0.length - 1);

        const L = ch0[i] ?? 0;
        const R = ch1[i] ?? 0;
        const normalizedAmp = clamp(Math.sqrt(L * L + R * R), 0, 1);

        const transformed = applyNarrativeTransform(frame.mapPoint(u, L, R, normalizedAmp), {
            L,
            R,
            normalizedAmp,
            uAngle: u,
            frameIndex,
            frameCount,
            z0: frame.z0,
        });

        pos[p] = transformed.x;
        pos[p + 1] = transformed.y;
        pos[p + 2] = transformed.z;

        // Lightness/saturation vary per point with amplitude
        const lightness = baseLightness + normalizedAmp * amplitudeBrightnessFactor;
        const saturation = clamp(baseSaturation + normalizedAmp * (1 - baseSaturation), baseSaturation, 1);
        color.setHSL(hue, saturation, lightness);
        colors[p] = color.r;
        colors[p + 1] = color.g;
        colors[p + 2] = color.b;

        // Store oscillation data for this point
        const pointIndex = frameIndex * pointsPerFrame + k;
        frequencies[pointIndex] = freqContentToHz(analyzeLocalFrequency(ch0, ch1, i));
        amplitudes[pointIndex] = ampToOscillationRange(normalizedAmp);

        // Store anchor position (original position before any oscillation)
        anchorPositions[p] = pos[p] ?? 0;
        anchorPositions[p + 1] = pos[p + 1] ?? 0;
        anchorPositions[p + 2] = pos[p + 2] ?? 0;

        p += 3;
    }
};

const updateLiveSnapshotCorridor = () => {
    // Build frames progressively up to the current playback-derived target.
    if (!renderer.hasGeometry() || !corridorState.value.buffer) return;

    const targetFrame = getTargetFrameForPlayback();
    const remaining = targetFrame - corridorState.value.builtFrames;
    if (remaining <= 0) return;

    // Avoid big hitches if the user seeks forward or loads a long file.
    const MAX_FRAMES_PER_TICK = 6;
    const toBuild = Math.min(remaining, MAX_FRAMES_PER_TICK);

    for (let i = 0; i < toBuild; i++) {
        buildOneFrame(corridorState.value.builtFrames);
        corridorState.value.builtFrames++;
    }

    const builtPoints = corridorState.value.builtFrames * corridorMeta.value.pointsPerFrame;

    // Update geometry
    renderer.updateDrawRange(builtPoints);
    renderer.markGeometryForUpdate(true, true);
};

const updateAutoFollowCamera = (time: number) => {
    if (cameraMode.value === 'free' || !renderer.hasGeometry() || !corridorState.value.buffer) return;

    const camObj = three.controls.value?.object;
    if (!camObj) return;

    const galleryY = 1.7; // gallery.position.y
    const lerpFactor = 0.1;
    let targetPos: { x: number; y: number; z: number };
    let lookTarget: THREE.Vector3;

    const orbit = TOPOLOGIES[topologyMode.value].orbit;
    if (orbit) {
        // Centre-orbiting topologies (sphere, attractor): a Lissajous-like
        // path around the origin whose constants come from the registry.
        // Elevation starts at the top (cos term = 1) and naturally drifts
        // down; the second sine term varies the path so it never repeats,
        // and the radius wobble keeps the viewing distance alive.
        const t = (time - sphereOrbitStartTime.value) * orbit.speed;
        const horizontalAngle = t;
        const elevationAngle =
            Math.cos(t * orbit.elevCosFreq) * orbit.elevCosAmp + Math.sin(t * orbit.elevSinFreq) * orbit.elevSinAmp;
        const r = orbit.radius + Math.sin(t * orbit.wobbleFreq) * orbit.wobbleAmp;

        targetPos = {
            x: Math.cos(horizontalAngle) * Math.cos(elevationAngle) * r,
            y: galleryY + Math.sin(elevationAngle) * r,
            z: Math.sin(horizontalAngle) * Math.cos(elevationAngle) * r,
        };

        lookTarget = new THREE.Vector3(0, galleryY, 0);
    } else {
        // Corridor mode
        const headFrameIndex = corridorState.value.builtFrames - 1;
        if (headFrameIndex < 0) return;

        const frameCenteringDivisor = 2;
        const headZ =
            (headFrameIndex - corridorState.value.frameCount / frameCenteringDivisor) * corridorMeta.value.zStep;

        if (cameraMode.value === 'orbit') {
            // Drone-like orbit around the corridor head
            // Uses Lissajous-like path
            const orbitRadius = 8.0;
            const verticalAmplitude = 3.0;
            const orbitSpeed = 0.15; // Slow rotation

            // Different frequencies for each axis create figure-8 like patterns
            const horizontalAngle = time * orbitSpeed;
            const verticalAngle = time * orbitSpeed * 0.7; // Slower vertical oscillation
            const tiltAngle = time * orbitSpeed * 0.3; // Even slower tilt

            // Orbit in XZ plane around the head, with Y oscillation
            targetPos = {
                x: Math.cos(horizontalAngle) * orbitRadius * (1 + Math.sin(tiltAngle) * 0.3),
                y: galleryY + 2 + Math.sin(verticalAngle) * verticalAmplitude,
                z: headZ + Math.sin(horizontalAngle) * orbitRadius,
            };
        } else {
            // Follow mode: isometric angle behind and above the head
            const offset = {
                x: 5.0, // to the side
                y: 4.5, // above
                z: 7.0, // behind the head
            };

            targetPos = {
                x: offset.x,
                y: galleryY + offset.y,
                z: headZ + offset.z,
            };
        }

        lookTarget = new THREE.Vector3(0, galleryY, headZ);
    }

    // Smooth camera movement
    camObj.position.x += (targetPos.x - camObj.position.x) * lerpFactor;
    camObj.position.y += (targetPos.y - camObj.position.y) * lerpFactor;
    camObj.position.z += (targetPos.z - camObj.position.z) * lerpFactor;

    // Look at the target
    three.camera.value?.lookAt(lookTarget);
};

// ---------- Main loop ----------
let lastFrameTime = 0;

const animate = (now: number) => {
    // Calculate delta time (capped at 33ms to avoid large jumps)
    const maxDeltaTime = 0.033;
    const dt = Math.min(maxDeltaTime, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    movement.update(dt);

    if (renderer.hasGeometry()) {
        // Build points progressively as playback advances
        updateLiveSnapshotCorridor();
        // Update camera based on current mode
        const timeInSeconds = now / 1000;
        updateAutoFollowCamera(timeInSeconds);
        // Apply oscillation to existing points if enabled
        if (oscillation.enabled.value) {
            oscillation.oscillate(timeInSeconds, toRaw(corridorState.value), {
                pointsPerFrame: corridorMeta.value.pointsPerFrame,
            });
        }
    }

    const r = three.renderer.value;
    const c = three.camera.value;
    dreamBg.update(now / 1000, c?.position);
    heavenlyBg.update(now / 1000, c?.position);
    if (r && c) r.render(scene, c);
    requestAnimFrame = requestAnimationFrame(animate);
};

// Watch for render mode changes and update visibility
watch(renderMode, (newMode) => {
    renderer.setRenderMode(newMode);
});

// Restore smooth curves when oscillation is disabled
watch(oscillation.enabled, (enabled) => {
    if (!enabled) {
        oscillation.restoreAnchorPositions(toRaw(corridorState.value), {
            pointsPerFrame: corridorMeta.value.pointsPerFrame,
        });
    }
});

watch(topologyMode, () => {
    applyTopologyCameraDefaults();
});

watch(narrativeEnabled, (enabled) => {
    if (renderer.hasGeometry() && enabled) {
        renderer.markGeometryForUpdate(true, true);
    }
});

// Cycle through camera modes: free -> follow -> orbit -> free
const toggleCameraMode = () => {
    // Only allow toggling if WAV is loaded
    if (!wavLoaded.value) return;

    const modes: CameraMode[] = ['free', 'follow', 'orbit'];
    const currentIndex = modes.indexOf(cameraMode.value);
    const nextIndex = (currentIndex + 1) % modes.length;
    cameraMode.value = modes[nextIndex] ?? 'free';

    // Exit pointer lock when entering follow/orbit mode so camera can move smoothly
    if (cameraMode.value !== 'free' && document.pointerLockElement) {
        document.exitPointerLock();
    }
};

// Set a camera mode directly (from the controls overlay). Mirrors the pointer-lock
// side effect of the cycle handler.
const setCameraMode = (mode: CameraMode) => {
    if (!wavLoaded.value) return;
    cameraMode.value = mode;
    if (mode !== 'free' && document.pointerLockElement) {
        document.exitPointerLock();
    }
};

// Set movement speed level directly (slow / medium / fast = 0 / 1 / 2).
const setMovementSpeed = (index: number) => {
    movement.speedIndex.value = Math.min(2, Math.max(0, index));
};

// Keyboard shortcuts
const shortcuts = useKeyboardShortcuts();
shortcuts.register('r', () => {
    renderMode.value = renderMode.value === 'points' ? 'lines' : 'points';
});
shortcuts.register('o', () => {
    oscillation.enabled.value = !oscillation.enabled.value;
});
shortcuts.register('f', () => {
    three.toggleFullscreen();
});
shortcuts.register('enter', () => {
    handlePlayPause();
});
shortcuts.register('h', () => {
    toggleControls();
});
shortcuts.register('c', () => {
    toggleCameraMode();
});
shortcuts.register('v', () => {
    useAlternateColors.value = !useAlternateColors.value;
});
shortcuts.register('b', () => {
    dreamBg.enabled.value = !dreamBg.enabled.value;
    if (dreamBg.enabled.value) heavenlyBg.enabled.value = false;
});
shortcuts.register('n', () => {
    heavenlyBg.enabled.value = !heavenlyBg.enabled.value;
    if (heavenlyBg.enabled.value) dreamBg.enabled.value = false;
});

const onDreamBgToggle = () => {
    if (dreamBg.enabled.value) heavenlyBg.enabled.value = false;
};
const onHeavenlyBgToggle = () => {
    if (heavenlyBg.enabled.value) dreamBg.enabled.value = false;
};
shortcuts.register('{', () => playAdjacentTrack(-1));
shortcuts.register('}', () => playAdjacentTrack(1));

// Media Session API — handles hardware media keys on macOS (and other OSes)
// Registered in onMounted to avoid SSR access to navigator
const initMediaSessionHandlers = () => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('nexttrack', () => playAdjacentTrack(1));
    navigator.mediaSession.setActionHandler('previoustrack', () => playAdjacentTrack(-1));
};

onMounted(() => {
    initaliseScene();
    initMediaSessionHandlers();
    requestAnimFrame = requestAnimationFrame(animate);
});

onUnmounted(async () => {
    if (requestAnimFrame !== null) {
        cancelAnimationFrame(requestAnimFrame);
        requestAnimFrame = null;
    }

    await disposeWavPlayer();
    clearCorridor();
    dreamBg.dispose();
    heavenlyBg.dispose();
    three.dispose();

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
    }
});
</script>

<template>
    <div class="fixed inset-0 overflow-hidden bg-(--bg) text-(--text)">
        <!-- Live canvas fills the viewport; slow-zooms while playing (plan 2.8,
             a transform on the container only - the engine is untouched) -->
        <div
            ref="canvasContainer"
            class="absolute inset-0 bg-black motion-safe:transition-transform motion-safe:duration-[6000ms] motion-safe:ease-(--motion-ease-standard)"
            :class="{ 'motion-safe:scale-[1.04]': !!audio.source }"
        ></div>

        <!-- Vignette + scrim so the floating glass chrome clears AA over the
             canvas: a radial vignette plus top/bottom linear scrims (per the
             design comp), with a faint scanline grain blended over the top. -->
        <div
            class="pointer-events-none absolute inset-0 z-0"
            style="
                background:
                    radial-gradient(
                        120% 90% at 50% 35%,
                        transparent 0%,
                        color-mix(in oklch, var(--bg) 72%, transparent) 78%,
                        var(--bg) 100%
                    ),
                    linear-gradient(
                        to bottom,
                        color-mix(in oklch, var(--bg) 55%, transparent),
                        transparent 22%,
                        transparent 60%,
                        color-mix(in oklch, var(--bg) 70%, transparent)
                    );
            "
        ></div>
        <div class="ps-striation pointer-events-none absolute inset-0 z-0 opacity-50 mix-blend-overlay"></div>

        <!-- No-audio idle state: a restrained mono hint in the canvas void -->
        <!-- (nudged below the side panels on desktop so it sits in the void) -->
        <div
            v-if="!wavLoaded"
            class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 md:translate-y-[16vh]"
        >
            <DsLogo :size="56" mono class="text-(--text-faint)" />
            <p class="ps-label">No signal</p>
            <p class="text-detail text-(--text-faint)">Load audio or select a demo track to begin</p>
        </div>

        <!-- Top: floating header -->
        <LayoutAppHeader
            class="absolute inset-x-5 top-5 z-30"
            :controls-open="showControlsOverlay"
            :settings-open="showSettings"
            @toggle-controls="toggleControls"
            @toggle-settings="toggleSettings"
            @toggle-fullscreen="three.toggleFullscreen"
        />

        <!-- Left: display settings (advanced options disclosed in-panel) -->
        <div
            v-if="showSettings"
            class="ps-rise absolute left-5 top-24 z-20 max-h-[calc(100svh_-_12rem)] w-[min(100vw_-_2.5rem,37.5rem)] overflow-y-auto"
        >
            <LayoutDisplayPanel
                variant="glass"
                v-model:pointsPerFrame="corridorMeta.pointsPerFrame"
                v-model:coverage="trackCoveragePercent"
                v-model:renderMode="renderMode"
                v-model:topology="topologyMode"
                v-model:oscillation="oscillation.enabled.value"
                v-model:reverse="useAlternateColors"
                v-model:controlsOverlay="showControlsOverlay"
                :dream="dreamBg.enabled.value"
                :heavenly="heavenlyBg.enabled.value"
                :wav-loaded="wavLoaded"
                :settings-disabled="audio.started || !wavLoaded"
                :topology-disabled="audio.started"
                :perf-level="pointsWarningLevel"
                :perf-points="formatPointCount(effectiveMaxPoints)"
                @update:dream="
                    (v) => {
                        dreamBg.enabled.value = v;
                        onDreamBgToggle();
                    }
                "
                @update:heavenly="
                    (v) => {
                        heavenlyBg.enabled.value = v;
                        onHeavenlyBgToggle();
                    }
                "
            >
                <template #advanced>
                    <LayoutAdvancedPanel
                        v-model:open="advancedOptionsOpen"
                        v-model:mode="oscillation.mode.value"
                        v-model:narrative="narrativeEnabled"
                        v-model:stage="narrativeStage"
                        v-model:chirality="narrativeHandedBias"
                        v-model:auto-stage="narrativeAutoStage"
                    />
                </template>
            </LayoutDisplayPanel>
        </div>

        <!-- Right: live controls HUD -->
        <LayoutControlsOverlay
            v-if="showControlsOverlay"
            class="ps-rise absolute right-5 top-24 z-20 max-h-[calc(100svh_-_12rem)] overflow-y-auto"
            :camera-mode="cameraMode"
            :speed-index="movement.speedIndex.value"
            :moving="movement.isMoving.value"
            :disabled="!wavLoaded"
            @set-camera-mode="setCameraMode"
            @set-speed="setMovementSpeed"
            @close="showControlsOverlay = false"
        />

        <!-- Bottom: transport dock (skip-link target: the primary controls) -->
        <main id="content" tabindex="-1" class="focus-visible:outline-none">
            <LayoutTransportBar
                class="absolute inset-x-4 bottom-5 z-30 mx-auto w-fit max-w-[calc(100vw_-_2rem)]"
                :playing="!!audio.source"
                :audio-loaded="wavLoaded"
                :started="audio.started"
                :elapsed="elapsedLabel"
                :tracks="sortedDemoTracks.map((t) => ({ label: t.name, value: t.id }))"
                :tracks-loading="demoTracksLoading"
                :selected-track="selectedDemoTrackId"
                @play-pause="handlePlayPause"
                @stop="handleStop"
                @load-file="(file: File) => loadWavFile(file).catch(onAudioLoadError)"
                @select-track="handleSelectDemoTrack"
            />
        </main>
    </div>
</template>
