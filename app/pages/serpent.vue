<script setup lang="ts">
import * as THREE from 'three';
import { toRaw } from 'vue';
import { analyzeFrequencyBand, freqContentToHz, ampToOscillationRange } from '~/utils/audio/analysis';
import type { RenderMode } from '~/composables/useCorridorRenderer.client';
import { useNarrativeTransform } from '~/composables/experimental/useNarrativeTransform';

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
const dreamBg    = useDreamBackground(scene);
const heavenlyBg = useHeavenlyBackground(scene);

type CameraMode = 'free' | 'follow' | 'orbit';
const cameraMode = ref<CameraMode>('orbit');

type TopologyMode = 'corridor' | 'sphere' | 'attractor';
const topologyMode = ref<TopologyMode>('corridor');

const toast = useToast();

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
const advancedOptionsOpen = ref(false);
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
    hopSize: number,
): { spine: Float32Array; normals: Float32Array; binormals: Float32Array } => {
    const σ = 10, β = 8 / 3;
    const ρMin = 25, ρMax = 38;
    const dt = 0.01;
    const stepsPerFrame = 4;

    // 1. Compute RMS amplitude envelope per frame
    const envelope = new Float32Array(frameCount);
    let maxEnv = 0;
    for (let f = 0; f < frameCount; f++) {
        const start = f * hopSize;
        const end = Math.min(start + hopSize, ch0.length);
        let sum = 0;
        for (let i = start; i < end; i++) { const s = ch0[i] ?? 0; sum += s * s; }
        envelope[f] = Math.sqrt(sum / Math.max(1, end - start));
        if ((envelope[f] ?? 0) > maxEnv) maxEnv = envelope[f] ?? 0;
    }
    if (maxEnv < 0.0001) maxEnv = 0.0001;

    // 2. Warm-up: integrate 5000 steps to settle onto attractor
    let x = 0.1, y = 0.0, z = 0.0;
    for (let s = 0; s < 5000; s++) {
        const k1x = σ*(y-x),       k1y = x*(ρMin-z)-y, k1z = x*y-β*z;
        const x2 = x+.5*dt*k1x,    y2 = y+.5*dt*k1y,   z2 = z+.5*dt*k1z;
        const k2x = σ*(y2-x2),     k2y = x2*(ρMin-z2)-y2, k2z = x2*y2-β*z2;
        const x3 = x+.5*dt*k2x,    y3 = y+.5*dt*k2y,   z3 = z+.5*dt*k2z;
        const k3x = σ*(y3-x3),     k3y = x3*(ρMin-z3)-y3, k3z = x3*y3-β*z3;
        const x4 = x+dt*k3x,       y4 = y+dt*k3y,       z4 = z+dt*k3z;
        const k4x = σ*(y4-x4),     k4y = x4*(ρMin-z4)-y4, k4z = x4*y4-β*z4;
        x += (dt/6)*(k1x+2*k2x+2*k3x+k4x);
        y += (dt/6)*(k1y+2*k2y+2*k3y+k4y);
        z += (dt/6)*(k1z+2*k2z+2*k3z+k4z);
    }

    // 3. Integrate trajectory, modulating ρ by the amplitude envelope
    const spine = new Float32Array(frameCount * 3);
    for (let f = 0; f < frameCount; f++) {
        const ρ = ρMin + clamp((envelope[f] ?? 0) / maxEnv, 0, 1) * (ρMax - ρMin);
        for (let s = 0; s < stepsPerFrame; s++) {
            const k1x = σ*(y-x),       k1y = x*(ρ-z)-y,   k1z = x*y-β*z;
            const x2 = x+.5*dt*k1x,    y2 = y+.5*dt*k1y,  z2 = z+.5*dt*k1z;
            const k2x = σ*(y2-x2),     k2y = x2*(ρ-z2)-y2, k2z = x2*y2-β*z2;
            const x3 = x+.5*dt*k2x,    y3 = y+.5*dt*k2y,  z3 = z+.5*dt*k2z;
            const k3x = σ*(y3-x3),     k3y = x3*(ρ-z3)-y3, k3z = x3*y3-β*z3;
            const x4 = x+dt*k3x,       y4 = y+dt*k3y,      z4 = z+dt*k3z;
            const k4x = σ*(y4-x4),     k4y = x4*(ρ-z4)-y4, k4z = x4*y4-β*z4;
            x += (dt/6)*(k1x+2*k2x+2*k3x+k4x);
            y += (dt/6)*(k1y+2*k2y+2*k3y+k4y);
            z += (dt/6)*(k1z+2*k2z+2*k3z+k4z);
        }
        spine[f * 3] = x; spine[f * 3 + 1] = y; spine[f * 3 + 2] = z;
    }

    // 4. Center and scale to fit scene (diameter 12 → radius 6)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let f = 0; f < frameCount; f++) {
        const fx = spine[f*3] ?? 0, fy = spine[f*3+1] ?? 0, fz = spine[f*3+2] ?? 0;
        if (fx < minX) minX = fx; if (fx > maxX) maxX = fx;
        if (fy < minY) minY = fy; if (fy > maxY) maxY = fy;
        if (fz < minZ) minZ = fz; if (fz > maxZ) maxZ = fz;
    }
    const cx = (minX+maxX)/2, cy = (minY+maxY)/2, cz = (minZ+maxZ)/2;
    const maxExtent = Math.max(maxX-minX, maxY-minY, maxZ-minZ);
    const scale = maxExtent > 0 ? 12 / maxExtent : 1;
    for (let f = 0; f < frameCount; f++) {
        spine[f*3]   = ((spine[f*3]   ?? 0) - cx) * scale;
        spine[f*3+1] = ((spine[f*3+1] ?? 0) - cy) * scale;
        spine[f*3+2] = ((spine[f*3+2] ?? 0) - cz) * scale;
    }

    // 5. Compute Frenet frames via parallel transport (avoids degenerate normals at inflection points)
    const normals   = new Float32Array(frameCount * 3);
    const binormals = new Float32Array(frameCount * 3);

    // Initial tangent T0 = normalize(P1 - P0)
    let tx = (spine[3]??0)-(spine[0]??0), ty = (spine[4]??0)-(spine[1]??0), tz = (spine[5]??0)-(spine[2]??0);
    let tlen = Math.sqrt(tx*tx+ty*ty+tz*tz); if (tlen < 1e-10) tlen = 1;
    tx /= tlen; ty /= tlen; tz /= tlen;

    // Initial normal via Gram-Schmidt with an arbitrary reference vector
    let ax = 0, ay = 1, az = 0;
    if (Math.abs(ty) > 0.9) { ax = 1; ay = 0; }
    const d0 = ax*tx + ay*ty + az*tz;
    ax -= d0*tx; ay -= d0*ty; az -= d0*tz;
    let nlen = Math.sqrt(ax*ax+ay*ay+az*az); if (nlen < 1e-10) nlen = 1;
    let nx = ax/nlen, ny = ay/nlen, nz = az/nlen;
    let bx = ty*nz-tz*ny, by = tz*nx-tx*nz, bz = tx*ny-ty*nx;
    normals[0] = nx; normals[1] = ny; normals[2] = nz;
    binormals[0] = bx; binormals[1] = by; binormals[2] = bz;

    for (let f = 1; f < frameCount; f++) {
        const pi = f*3, pp = (f-1)*3;
        let ntx = (spine[pi]??0)-(spine[pp]??0), nty = (spine[pi+1]??0)-(spine[pp+1]??0), ntz = (spine[pi+2]??0)-(spine[pp+2]??0);
        let ntlen = Math.sqrt(ntx*ntx+nty*nty+ntz*ntz); if (ntlen < 1e-10) ntlen = 1;
        ntx /= ntlen; nty /= ntlen; ntz /= ntlen;

        // Rotation axis = T × T_new (parallel transport step)
        const rax = ty*ntz-tz*nty, ray = tz*ntx-tx*ntz, raz = tx*nty-ty*ntx;
        const raLen = Math.sqrt(rax*rax+ray*ray+raz*raz);
        if (raLen > 1e-8) {
            const rnx = rax/raLen, rny = ray/raLen, rnz = raz/raLen;
            const cosA = clamp(tx*ntx+ty*nty+tz*ntz, -1, 1);
            const sinA = raLen;
            const rdot = rnx*nx+rny*ny+rnz*nz;
            const crossX = rny*nz-rnz*ny, crossY = rnz*nx-rnx*nz, crossZ = rnx*ny-rny*nx;
            nx = nx*cosA + crossX*sinA + rnx*rdot*(1-cosA);
            ny = ny*cosA + crossY*sinA + rny*rdot*(1-cosA);
            nz = nz*cosA + crossZ*sinA + rnz*rdot*(1-cosA);
            const nl = Math.sqrt(nx*nx+ny*ny+nz*nz); if (nl > 1e-10) { nx/=nl; ny/=nl; nz/=nl; }
        }
        bx = nty*nz-ntz*ny; by = ntz*nx-ntx*nz; bz = ntx*ny-nty*nx;
        normals[f*3] = nx; normals[f*3+1] = ny; normals[f*3+2] = nz;
        binormals[f*3] = bx; binormals[f*3+1] = by; binormals[f*3+2] = bz;
        tx = ntx; ty = nty; tz = ntz;
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

    // Attractor topology: pre-compute Lorenz spine and Frenet frames at load time
    if (topologyMode.value === 'attractor') {
        const { spine, normals, binormals } = precomputeAttractorSpine(frameCount, ch0, hopSize);
        corridorState.value.attractorSpine = spine;
        corridorState.value.attractorNormals = normals;
        corridorState.value.attractorBinormals = binormals;
    }

    // Create geometries using renderer
    // Position depends on topology mode
    const isCorridor = topologyMode.value === 'corridor';
    const { positions } = renderer.createGeometry({
        totalPoints,
        renderMode,
        // Corridor extends along Z; sphere and attractor are centered at origin
        pointsPosition: isCorridor ? { x: 0, y: 1.7, z: 0.95 } : { x: 0, y: 1.7, z: 0 },
        linesPosition: isCorridor ? { x: 0, y: 1.7, z: 0 } : { x: 0, y: 1.7, z: 0 },
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
        toast.add({
            title: 'Failed to load demo track',
            description: error instanceof Error ? error.message : 'Unknown error',
            color: 'error',
            icon: 'i-heroicons-exclamation-triangle',
        });
        return false;
    } finally {
        demoTracksLoading.value = false;
    }
};

const onAudioLoadError = (error: Error) => {
    toast.add({
        title: 'Failed to load audio',
        description: error.message,
        color: 'error',
        icon: 'i-heroicons-exclamation-triangle',
    });
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

onTrackEnded(() => {
    // Only auto-advance if a demo track was playing (not a user-loaded file)
    if (autoPlayIndex.value < 0) return;
    const nextIndex = (autoPlayIndex.value + 1) % sortedDemoTracks.value.length;
    if (sortedDemoTracks.value.length > 0) {
        playAutoTrackAtIndex(nextIndex);
    }
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

const buildOneCorridorFrame = (frameIndex: number) => {
    // Writes a single frame into the preallocated positions buffer.
    const { pointsPerFrame, windowSize, hopSize, zStep } = corridorMeta.value;
    // Use toRaw to ensure we write to the actual Float32Arrays, not Vue proxies
    const rawState = toRaw(corridorState.value);
    const { ch0, ch1, frameCount, xyScale, ringRadius, pos, frequencies, amplitudes, anchorPositions } = rawState;
    if (!pos || !ch0 || !ch1 || !renderer.hasGeometry()) return;
    if (!frequencies || !amplitudes || !anchorPositions) return;

    const frameStart = frameIndex * hopSize;
    const z0 = (frameIndex - frameCount / 2) * zStep;

    // Each frame occupies a contiguous block.
    let p = frameIndex * pointsPerFrame * 3;
    const colors = renderer.getColorArray();
    if (!colors) return;

    // Reuse a single Color object to avoid allocating one per point
    const color = new THREE.Color();

    // Precompute frequency analysis once per frame (at frame center)
    // This avoids redundant analysis since frequency content doesn't change
    // meaningfully within a single frame's time window (~23ms)
    const analysisWindow = 4096; // Fixed window size for good frequency/time balance
    const frameCenterSample = clamp(frameStart + windowSize / 2, 0, ch0.length - 1);
    const windowStart = Math.max(0, frameCenterSample - analysisWindow / 2);
    const freqL = analyzeFrequencyBand(ch0, windowStart, analysisWindow);
    const freqR = analyzeFrequencyBand(ch1, windowStart, analysisWindow);
    const freqContent = (freqL + freqR) / 2; // 0 = low freq, 1 = high freq

    // Precompute hue from frequency (same for all points in frame)
    const reverseSpectrum = useAlternateColors.value;
    const hueRangeMultiplier = 0.75;
    // Default:  bass (0) = BLUE/MAGENTA → treble (1) = RED
    // Reversed: bass (0) = RED → treble (1) = BLUE/MAGENTA
    const hue = reverseSpectrum
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

        // Core portrait (XY)
        const x2 = L * xyScale;
        const y2 = R * xyScale;

        // Calculate amplitude for brightness (varies per point)
        const amplitude = Math.sqrt(L * L + R * R);
        const normalizedAmp = clamp(amplitude, 0, 1);

        // Lightweight per-point frequency estimate for oscillation
        // Uses 8 samples instead of full analysis
        const microWindow = 8;
        const halfMicro = microWindow / 2;
        let localChangeEnergy = 0;
        let localAmpEnergy = 0;
        for (let m = -halfMicro; m < halfMicro; m++) {
            const idx = clamp(i + m, 0, ch0.length - 2);
            const s0 = (ch0[idx] ?? 0) + (ch1[idx] ?? 0);
            const s1 = (ch0[idx + 1] ?? 0) + (ch1[idx + 1] ?? 0);
            const diff = s1 - s0;
            localChangeEnergy += diff * diff;
            localAmpEnergy += s0 * s0;
        }
        const localTotal = Math.sqrt(localChangeEnergy) + Math.sqrt(localAmpEnergy);
        const localFreqContent =
            localTotal > 0.001 ? clamp((Math.sqrt(localChangeEnergy) / localTotal) * 3, 0, 1) : 0.5;
        const pointFreqHz = freqContentToHz(localFreqContent);

        // Lightness varies per point based on amplitude
        const lightness = baseLightness + normalizedAmp * amplitudeBrightnessFactor;
        const saturation = clamp(baseSaturation + normalizedAmp * (1 - baseSaturation), baseSaturation, 1);
        color.setHSL(hue, saturation, lightness);

        // Stable 3D: wrap around a ring so each frame becomes a "floating wreath" you can walk through
        const ringX = Math.cos(u) * ringRadius;
        const ringZ = Math.sin(u) * ringRadius;

        const basePos = {
            x: ringX + x2,
            y: y2, // portrait controls vertical shape
            z: ringZ + z0, // time corridor backbone
        };

        const transformed = applyNarrativeTransform(basePos, {
            L,
            R,
            normalizedAmp,
            uAngle: u,
            frameIndex,
            frameCount,
            z0,
        });

        pos[p] = transformed.x;
        pos[p + 1] = transformed.y;
        pos[p + 2] = transformed.z;

        // Set color for this point
        colors[p] = color.r;
        colors[p + 1] = color.g;
        colors[p + 2] = color.b;

        // Store oscillation data for this point
        const pointIndex = frameIndex * pointsPerFrame + k;
        frequencies[pointIndex] = pointFreqHz;
        amplitudes[pointIndex] = ampToOscillationRange(normalizedAmp);

        // Store anchor position (original position before any oscillation)
        anchorPositions[p] = pos[p] ?? 0;
        anchorPositions[p + 1] = pos[p + 1] ?? 0;
        anchorPositions[p + 2] = pos[p + 2] ?? 0;

        const positionIncrement = 3;
        p += positionIncrement;
    }
};

const buildOneSphereFrame = (frameIndex: number) => {
    // Spherical topology: map audio onto a sphere with surface displacement
    const { pointsPerFrame, windowSize, hopSize } = corridorMeta.value;
    const rawState = toRaw(corridorState.value);
    const { ch0, ch1, frameCount, pos, frequencies, amplitudes, anchorPositions } = rawState;
    if (!pos || !ch0 || !ch1 || !renderer.hasGeometry()) return;
    if (!frequencies || !amplitudes || !anchorPositions) return;

    const frameStart = frameIndex * hopSize;

    // Spherical parameters
    const baseRadius = 5.0;
    const displacementScale = 1.5;

    // Map frame index to polar angle (phi): time evolution from north to south pole
    const phi = (frameIndex / frameCount) * Math.PI;

    // Each frame occupies a contiguous block
    let p = frameIndex * pointsPerFrame * 3;
    const colors = renderer.getColorArray();
    if (!colors) return;

    // Reuse a single Color object to avoid allocating one per point
    const color = new THREE.Color();

    // Precompute frequency analysis once per frame (at frame center)
    const analysisWindow = 4096;
    const frameCenterSample = clamp(frameStart + windowSize / 2, 0, ch0.length - 1);
    const windowStart = Math.max(0, frameCenterSample - analysisWindow / 2);
    const freqL = analyzeFrequencyBand(ch0, windowStart, analysisWindow);
    const freqR = analyzeFrequencyBand(ch1, windowStart, analysisWindow);
    const freqContent = (freqL + freqR) / 2;

    // Precompute hue from frequency (same for all points in frame)
    const reverseSpectrum = useAlternateColors.value;
    const hueRangeMultiplier = 0.75;
    const hue = reverseSpectrum
        ? freqContent * hueRangeMultiplier
        : hueRangeMultiplier - freqContent * hueRangeMultiplier;
    const baseSaturation = 0.92;
    const baseLightness = 0.35;
    const amplitudeBrightnessFactor = 0.35;

    for (let k = 0; k < pointsPerFrame; k++) {
        // Map point index to azimuth angle (theta): full rotation around sphere
        const theta = (k / pointsPerFrame) * Math.PI * 2;

        const sampleIndex = frameStart + Math.floor((k / pointsPerFrame) * windowSize);
        const i = clamp(sampleIndex, 0, ch0.length - 1);

        const L = ch0[i] ?? 0;
        const R = ch1[i] ?? 0;

        // Calculate amplitude for radial displacement
        const amplitude = Math.sqrt(L * L + R * R);
        const normalizedAmp = clamp(amplitude, 0, 1);

        // Radial displacement based on amplitude
        const displacement = normalizedAmp * displacementScale;
        const r = baseRadius + displacement;

        // Spherical to Cartesian conversion
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);

        // Lightness varies per point based on amplitude
        const lightness = baseLightness + normalizedAmp * amplitudeBrightnessFactor;
        const saturation = clamp(baseSaturation + normalizedAmp * (1 - baseSaturation), baseSaturation, 1);
        color.setHSL(hue, saturation, lightness);

        const basePos = { x, y, z };

        const transformed = applyNarrativeTransform(basePos, {
            L,
            R,
            normalizedAmp,
            uAngle: theta,
            frameIndex,
            frameCount,
            z0: 0,
        });

        // Set position
        pos[p] = transformed.x;
        pos[p + 1] = transformed.y;
        pos[p + 2] = transformed.z;

        // Set color
        colors[p] = color.r;
        colors[p + 1] = color.g;
        colors[p + 2] = color.b;

        // Lightweight per-point frequency estimate for oscillation
        const microWindow = 8;
        const halfMicro = microWindow / 2;
        let localChangeEnergy = 0;
        let localAmpEnergy = 0;
        for (let m = -halfMicro; m < halfMicro; m++) {
            const idx = clamp(i + m, 0, ch0.length - 2);
            const s0 = (ch0[idx] ?? 0) + (ch1[idx] ?? 0);
            const s1 = (ch0[idx + 1] ?? 0) + (ch1[idx + 1] ?? 0);
            const diff = s1 - s0;
            localChangeEnergy += diff * diff;
            localAmpEnergy += s0 * s0;
        }
        const localTotal = Math.sqrt(localChangeEnergy) + Math.sqrt(localAmpEnergy);
        const localFreqContent =
            localTotal > 0.001 ? clamp((Math.sqrt(localChangeEnergy) / localTotal) * 3, 0, 1) : 0.5;
        const pointFreqHz = freqContentToHz(localFreqContent);

        // Store oscillation data for this point
        const pointIndex = frameIndex * pointsPerFrame + k;
        frequencies[pointIndex] = pointFreqHz;
        amplitudes[pointIndex] = ampToOscillationRange(normalizedAmp);

        // Store anchor position (original position before any oscillation)
        anchorPositions[p] = pos[p] ?? 0;
        anchorPositions[p + 1] = pos[p + 1] ?? 0;
        anchorPositions[p + 2] = pos[p + 2] ?? 0;

        const positionIncrement = 3;
        p += positionIncrement;
    }
};

const buildOneAttractorFrame = (frameIndex: number) => {
    const { pointsPerFrame, windowSize, hopSize } = corridorMeta.value;
    const rawState = toRaw(corridorState.value);
    const { ch0, ch1, frameCount, pos, frequencies, amplitudes, anchorPositions,
            attractorSpine, attractorNormals, attractorBinormals } = rawState;
    if (!pos || !ch0 || !ch1 || !renderer.hasGeometry()) return;
    if (!frequencies || !amplitudes || !anchorPositions) return;
    if (!attractorSpine || !attractorNormals || !attractorBinormals) return;

    const frameStart = frameIndex * hopSize;

    // Spine position and Frenet frame at this frame
    const spineX = attractorSpine[frameIndex * 3]     ?? 0;
    const spineY = attractorSpine[frameIndex * 3 + 1] ?? 0;
    const spineZ = attractorSpine[frameIndex * 3 + 2] ?? 0;
    const normX  = attractorNormals[frameIndex * 3]     ?? 0;
    const normY  = attractorNormals[frameIndex * 3 + 1] ?? 0;
    const normZ  = attractorNormals[frameIndex * 3 + 2] ?? 0;
    const binX   = attractorBinormals[frameIndex * 3]     ?? 0;
    const binY   = attractorBinormals[frameIndex * 3 + 1] ?? 0;
    const binZ   = attractorBinormals[frameIndex * 3 + 2] ?? 0;

    const baseTubeRadius = 0.15;
    const audioTubeScale = 0.6;

    let p = frameIndex * pointsPerFrame * 3;
    const colors = renderer.getColorArray();
    if (!colors) return;
    const color = new THREE.Color();

    // Frame-level frequency analysis (identical pattern to corridor/sphere)
    const analysisWindow = 4096;
    const frameCenterSample = clamp(frameStart + windowSize / 2, 0, ch0.length - 1);
    const windowStart = Math.max(0, frameCenterSample - analysisWindow / 2);
    const freqL = analyzeFrequencyBand(ch0, windowStart, analysisWindow);
    const freqR = analyzeFrequencyBand(ch1, windowStart, analysisWindow);
    const freqContent = (freqL + freqR) / 2;

    const reverseSpectrum = useAlternateColors.value;
    const hueRangeMultiplier = 0.75;
    const hue = reverseSpectrum
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
        const amplitude = Math.sqrt(L * L + R * R);
        const normalizedAmp = clamp(amplitude, 0, 1);

        // Tube cross-section: ring around spine, radius breathes with audio amplitude
        const tubeRadius = baseTubeRadius + normalizedAmp * audioTubeScale;
        const cosU = Math.cos(u);
        const sinU = Math.sin(u);

        const basePos = {
            x: spineX + tubeRadius * (cosU * normX + sinU * binX),
            y: spineY + tubeRadius * (cosU * normY + sinU * binY),
            z: spineZ + tubeRadius * (cosU * normZ + sinU * binZ),
        };

        const transformed = applyNarrativeTransform(basePos, {
            L,
            R,
            normalizedAmp,
            uAngle: u,
            frameIndex,
            frameCount,
            z0: 0,
        });

        pos[p]     = transformed.x;
        pos[p + 1] = transformed.y;
        pos[p + 2] = transformed.z;

        const lightness = baseLightness + normalizedAmp * amplitudeBrightnessFactor;
        const saturation = clamp(baseSaturation + normalizedAmp * (1 - baseSaturation), baseSaturation, 1);
        color.setHSL(hue, saturation, lightness);
        colors[p] = color.r; colors[p + 1] = color.g; colors[p + 2] = color.b;

        // Lightweight per-point frequency estimate for oscillation
        const microWindow = 8;
        const halfMicro = microWindow / 2;
        let localChangeEnergy = 0, localAmpEnergy = 0;
        for (let m = -halfMicro; m < halfMicro; m++) {
            const idx = clamp(i + m, 0, ch0.length - 2);
            const s0 = (ch0[idx] ?? 0) + (ch1[idx] ?? 0);
            const s1 = (ch0[idx + 1] ?? 0) + (ch1[idx + 1] ?? 0);
            const diff = s1 - s0;
            localChangeEnergy += diff * diff;
            localAmpEnergy += s0 * s0;
        }
        const localTotal = Math.sqrt(localChangeEnergy) + Math.sqrt(localAmpEnergy);
        const localFreqContent =
            localTotal > 0.001 ? clamp((Math.sqrt(localChangeEnergy) / localTotal) * 3, 0, 1) : 0.5;
        const pointFreqHz = freqContentToHz(localFreqContent);

        const pointIndex = frameIndex * pointsPerFrame + k;
        frequencies[pointIndex] = pointFreqHz;
        amplitudes[pointIndex]  = ampToOscillationRange(normalizedAmp);

        anchorPositions[p]     = pos[p]     ?? 0;
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
        const f = corridorState.value.builtFrames;
        // Dispatch to the appropriate builder based on topology mode
        if (topologyMode.value === 'sphere') {
            buildOneSphereFrame(f);
        } else if (topologyMode.value === 'attractor') {
            buildOneAttractorFrame(f);
        } else {
            buildOneCorridorFrame(f);
        }
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

    if (topologyMode.value === 'sphere') {
        const sphereCenter = new THREE.Vector3(0, galleryY, 0);
        const orbitRadius = 12;
        const orbitSpeed = 0.2;

        const elapsed = time - sphereOrbitStartTime.value;
        const t = elapsed * orbitSpeed;

        // Horizontal angle, slow rotation around the sphere
        const horizontalAngle = t;

        // Elevation: starts at π/2 (directly above) and slowly descends
        // cos(t * 0.13) starts at 1 (top) and naturally drifts down
        // Second term adds variety so the path never repeats
        const elevationAngle = Math.cos(t * 0.13) * 1.22 + Math.sin(t * 0.37) * 0.35;

        // Slight radius variation
        const r = orbitRadius + Math.sin(t * 0.53) * 1.5;

        targetPos = {
            x: Math.cos(horizontalAngle) * Math.cos(elevationAngle) * r,
            y: galleryY + Math.sin(elevationAngle) * r,
            z: Math.sin(horizontalAngle) * Math.cos(elevationAngle) * r,
        };

        lookTarget = sphereCenter;
    } else if (topologyMode.value === 'attractor') {
        // Orbit the Lorenz butterfly — wider radius, slower drift to show the full structure
        const attractorCenter = new THREE.Vector3(0, galleryY, 0);
        const orbitRadius = 16;
        const orbitSpeed = 0.12;

        const elapsed = time - sphereOrbitStartTime.value;
        const t = elapsed * orbitSpeed;

        // Lissajous-like path gives varied viewing angles of the butterfly
        const horizontalAngle = t;
        const elevationAngle = Math.cos(t * 0.17) * 0.9 + Math.sin(t * 0.41) * 0.3;
        const r = orbitRadius + Math.sin(t * 0.47) * 2.5;

        targetPos = {
            x: Math.cos(horizontalAngle) * Math.cos(elevationAngle) * r,
            y: galleryY + Math.sin(elevationAngle) * r,
            z: Math.sin(horizontalAngle) * Math.cos(elevationAngle) * r,
        };

        lookTarget = attractorCenter;
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
    showControlsOverlay.value = !showControlsOverlay.value;
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
shortcuts.register('{', () => {
    if (sortedDemoTracks.value.length === 0) return;
    const prevIndex = (autoPlayIndex.value - 1 + sortedDemoTracks.value.length) % sortedDemoTracks.value.length;
    playAutoTrackAtIndex(prevIndex);
});
shortcuts.register('}', () => {
    if (sortedDemoTracks.value.length === 0) return;
    const nextIndex = (autoPlayIndex.value + 1) % sortedDemoTracks.value.length;
    playAutoTrackAtIndex(nextIndex);
});

// Media Session API — handles hardware media keys on macOS (and other OSes)
// Registered in onMounted to avoid SSR access to navigator
const initMediaSessionHandlers = () => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (sortedDemoTracks.value.length === 0) return;
        const nextIndex = (autoPlayIndex.value + 1) % sortedDemoTracks.value.length;
        playAutoTrackAtIndex(nextIndex);
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (sortedDemoTracks.value.length === 0) return;
        const prevIndex = (autoPlayIndex.value - 1 + sortedDemoTracks.value.length) % sortedDemoTracks.value.length;
        playAutoTrackAtIndex(prevIndex);
    });
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
    <div>
        <ProseH1>Serpentoscope</ProseH1>
        <ProseH2>Where Sound Draws Coils Through Explorable Space (prototype) WIP</ProseH2>

        <div class="flex items-center gap-4 mb-6">
            <div class="flex items-center">
                <PlayPauseButton :is-playing="!!audio.source" :disabled="!wavLoaded" @click="handlePlayPause" />
                <StopButton :disabled="!audio.started" @click="handleStop" />
                <AudioLoaderButton :handler="loadWavFile" @error="onAudioLoadError"> Load Audio </AudioLoaderButton>
            </div>

            <div v-if="sortedDemoTracks.length > 0" class="flex items-center gap-2">
                <span class="text-sm text-gray-500">or try a demo:</span>
                <USelectMenu
                    :model-value="selectedDemoTrackId"
                    :items="sortedDemoTracks.map((t) => ({ label: t.name, value: t.id }))"
                    placeholder="Select demo track"
                    value-key="value"
                    :loading="demoTracksLoading"
                    :disabled="demoTracksLoading"
                    class="w-48"
                    :ui="{ content: 'bg-white' }"
                    @update:model-value="(value: string) => value && handleLoadDemoTrack(value)"
                />
            </div>
        </div>

        <ProseH3>Display settings</ProseH3>
        <div class="border-accessible-blue w-full border-1 rounded-md py-4 px-6 mb-6">
            <div class="flex gap-16">
                <!-- Left Column -->
                <div class="flex-1 space-y-4">
                    <div class="mb-6" :class="{ 'opacity-40': audio.started || !wavLoaded }">
                        <label class="block font-bold text-primary text-lg mb-2">
                            Points Per Frame: <span class="text-secondary">{{ corridorMeta.pointsPerFrame }}</span>
                        </label>
                        <USlider
                            v-model="corridorMeta.pointsPerFrame"
                            :min="32"
                            :max="512"
                            :step="32"
                            :ui="{ thumb: 'bg-primary' }"
                            :disabled="audio.started || !wavLoaded"
                        />
                    </div>
                    <div class="mb-6" :class="{ 'opacity-40': audio.started || !wavLoaded }">
                        <label class="block font-bold text-primary text-lg mb-2">
                            Track Coverage: <span class="text-secondary">{{ trackCoveragePercent }}%</span>
                            <span v-if="wavLoaded" class="text-sm font-normal ml-2 text-gray-500">
                                ({{ formatPointCount(effectiveMaxPoints) }} points)
                            </span>
                        </label>
                        <USlider
                            v-model="trackCoveragePercent"
                            :min="10"
                            :max="100"
                            :step="5"
                            :ui="{ thumb: 'bg-primary' }"
                            :disabled="audio.started || !wavLoaded"
                        />
                        <p v-if="!wavLoaded" class="text-sm text-gray-400 mt-1">
                            Load a WAV file to enable this setting
                        </p>
                    </div>
                    <!-- Points warning -->
                    <div
                        v-if="wavLoaded && pointsWarningLevel !== 'none'"
                        class="p-3 rounded-md mb-4 bg-white border border-[color:var(--ui-warning)]"
                    >
                        <div class="flex items-start gap-2">
                            <UIcon
                                name="i-heroicons-exclamation-triangle"
                                class="size-5 mt-0.5 flex-shrink-0 text-[color:var(--ui-warning)]"
                            />
                            <div>
                                <p class="font-semibold text-sm text-[color:var(--ui-warning)]">
                                    {{
                                        pointsWarningLevel === 'danger'
                                            ? 'High Performance Risk'
                                            : 'Performance Warning'
                                    }}
                                </p>
                                <p class="text-sm text-[color:var(--ui-text)] mt-1">
                                    {{ formatPointCount(effectiveMaxPoints) }} points may
                                    {{
                                        pointsWarningLevel === 'danger'
                                            ? 'cause significant lag or crashes'
                                            : 'impact performance'
                                    }}
                                    on some devices. Consider reducing track coverage or points per frame.
                                </p>
                            </div>
                        </div>
                    </div>
                    <USeparator class="py-2" />
                    <div class="mb-6">
                        <URadioGroup
                            v-model="renderMode"
                            size="xl"
                            :items="[
                                { label: 'Points', value: 'points' },
                                { label: 'Lines', value: 'lines' },
                            ]"
                            :ui="{ legend: 'text-lg text-primary font-bold', label: 'text-primary' }"
                            value-key="value"
                            orientation="horizontal"
                        >
                            <template #legend>
                                <span class="inline-flex items-center gap-2">
                                    Render Mode
                                    <UKbd
                                        size="md"
                                        class="bg-primary text-white text-sm font-semibold ring-0 shadow-none cursor-default"
                                    >
                                        R
                                    </UKbd>
                                </span>
                            </template>
                        </URadioGroup>
                    </div>
                    <USeparator class="py-2" />
                    <ClientOnly>
                        <div class="flex items-center gap-3 mb-2">
                            <UCheckbox v-model="oscillation.enabled.value" id="oscillation-toggle" />
                            <label
                                for="oscillation-toggle"
                                class="text-primary text-lg font-bold cursor-pointer inline-flex items-center gap-2"
                            >
                                Enable Point Oscillation
                                <UKbd
                                    size="md"
                                    class="bg-primary text-white text-sm font-semibold ring-0 shadow-none cursor-default"
                                >
                                    O
                                </UKbd>
                            </label>
                        </div>
                    </ClientOnly>
                    <div class="flex items-center gap-3 mb-2">
                        <UCheckbox v-model="useAlternateColors" id="alt-colors-toggle" />
                        <label
                            for="alt-colors-toggle"
                            class="text-primary text-lg font-bold cursor-pointer inline-flex items-center gap-2"
                        >
                            Reverse Colour Spectrum
                            <UKbd
                                size="md"
                                class="bg-primary text-white text-sm font-semibold ring-0 shadow-none cursor-default"
                            >
                                V
                            </UKbd>
                        </label>
                    </div>
                    <div class="flex items-center gap-3 mb-2">
                        <UCheckbox v-model="dreamBg.enabled.value" id="dream-bg-toggle" @change="onDreamBgToggle" />
                        <label
                            for="dream-bg-toggle"
                            class="text-primary text-lg font-bold cursor-pointer inline-flex items-center gap-2"
                        >
                            Dream Background
                            <UKbd
                                size="md"
                                class="bg-primary text-white text-sm font-semibold ring-0 shadow-none cursor-default"
                            >
                                B
                            </UKbd>
                        </label>
                    </div>
                    <div class="flex items-center gap-3 mb-2">
                        <UCheckbox v-model="heavenlyBg.enabled.value" id="heavenly-bg-toggle" @change="onHeavenlyBgToggle" />
                        <label
                            for="heavenly-bg-toggle"
                            class="text-primary text-lg font-bold cursor-pointer inline-flex items-center gap-2"
                        >
                            Heavenly Background
                            <UKbd
                                size="md"
                                class="bg-primary text-white text-sm font-semibold ring-0 shadow-none cursor-default"
                            >
                                N
                            </UKbd>
                        </label>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="flex-1 space-y-4">
                    <div class="mb-6" :class="{ 'opacity-40': audio.started }">
                        <URadioGroup
                            v-model="topologyMode"
                            size="xl"
                            :items="[
                                { label: 'Corridor', value: 'corridor' },
                                { label: 'Sphere', value: 'sphere' },
                                { label: 'Attractor', value: 'attractor' },
                            ]"
                            :ui="{ legend: 'text-lg text-primary font-bold', label: 'text-primary' }"
                            value-key="value"
                            orientation="horizontal"
                            :disabled="audio.started"
                        >
                            <template #legend> Topology </template>
                        </URadioGroup>
                        <p class="text-sm text-gray-500 mt-2">
                            <span v-if="topologyMode === 'corridor'">Time unfolds along the Z-axis as a traversable tunnel.</span>
                            <span v-else-if="topologyMode === 'sphere'">Audio wraps around a sphere from north to south pole.</span>
                            <span v-else>Audio traces a Lorenz strange attractor — amplitude drives the chaos parameter ρ.</span>
                        </p>
                    </div>
                    <USeparator class="py-2" />
                    <div class="flex items-center gap-3 mb-2">
                        <UCheckbox v-model="showControlsOverlay" id="controls-overlay-toggle" />
                        <label
                            for="controls-overlay-toggle"
                            class="text-primary text-lg font-bold cursor-pointer inline-flex items-center gap-2"
                        >
                            Show Controls Overlay
                            <UKbd
                                size="md"
                                class="bg-primary text-white text-sm font-semibold ring-0 shadow-none cursor-default"
                            >
                                H
                            </UKbd>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between mb-2">
            <ProseH3 class="!mb-0">Advanced options</ProseH3>
            <button
                type="button"
                class="p-1 text-primary hover:text-primary/80 transition-colors cursor-pointer"
                @click="advancedOptionsOpen = !advancedOptionsOpen"
                :aria-expanded="advancedOptionsOpen"
                aria-controls="advanced-options-content"
            >
                <UIcon
                    :name="advancedOptionsOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                    class="size-6"
                />
            </button>
        </div>
        <div
            id="advanced-options-content"
            class="w-full border-1 rounded-md py-4 px-6 mb-6 transition-all duration-700 ease-out"
            :class="
                advancedOptionsOpen
                    ? 'max-h-[30rem] border-accessible-blue'
                    : 'max-h-5 overflow-hidden border-accessible-blue/30 [mask-image:linear-gradient(to_bottom,black_0%,transparent_100%)]'
            "
        >
            <URadioGroup
                v-model="oscillation.mode.value"
                size="xl"
                class="mb-2"
                :items="[
                    {
                        label: 'Wave',
                        value: 'wave',
                        description:
                            'Visualises loudness as a ripple propagating through the structure. Oscillates at a fixed visible speed; wave intensity reflects audio amplitude.',
                    },
                    {
                        label: 'Per-point',
                        value: 'per-point',
                        description:
                            'Visualises local frequency content. Each point oscillates at its own rate derived from the audio at that position.',
                    },
                    {
                        label: 'Per-frame',
                        value: 'per-frame',
                        description:
                            'Visualises average frequency per frame. All points in a frame move together at the same rate. Bass-heavy moments oscillate slower; treble-heavy moments faster.',
                    },
                ]"
                :ui="{
                    legend: 'text-lg text-primary font-bold',
                    label: 'text-primary',
                    description: 'text-gray-500',
                }"
                value-key="value"
                orientation="horizontal"
            >
                <template #legend> Oscillation Mode </template>
            </URadioGroup>
            <USeparator class="py-2 mb-2" />
            <div class="mb-6">
                <div class="flex items-center gap-3">
                    <UCheckbox v-model="narrativeEnabled" id="narrative-toggle" />
                    <label
                        for="narrative-toggle"
                        class="text-primary text-lg font-bold cursor-pointer inline-flex items-center gap-2"
                    >
                        Narrative Visualisation (Experimental)
                    </label>
                </div>
                <p class="text-sm text-gray-500 mt-1">Layers a staged transform over the audio geometry.</p>

                <div class="mt-4 mb-12 space-y-3" :class="{ 'opacity-40': !narrativeEnabled }">
                    <div v-if="narrativeEnabled && !narrativeAutoStage" class="mb-4">
                        <URadioGroup
                            v-model="narrativeStage"
                            size="xl"
                            :items="[
                                { label: 'Channel Bias', value: 'channel-bias' },
                                { label: 'Tilt', value: 'tilt' },
                                { label: 'Folding', value: 'folding' },
                                { label: 'Coils', value: 'coils' },
                                { label: 'Stabilization', value: 'stabilization' },
                                { label: 'Z-axis scaling', value: 'z-axis-scaling' },
                                { label: 'Radial flattening', value: 'radial-flattening' },
                                { label: 'Radial scaling', value: 'radial-scaling' },
                            ]"
                            :ui="{ legend: 'text-primary font-bold', label: 'text-primary' }"
                            value-key="value"
                            orientation="horizontal"
                            :disabled="!narrativeEnabled"
                        >
                            <template #legend> Stage </template>
                        </URadioGroup>
                    </div>

                    <div class="mb-6" :class="{ 'opacity-40': !narrativeEnabled }">
                        <label class="block font-bold text-primary mb-2">
                            Chirality Bias:
                            <span class="text-secondary">{{ narrativeHandedBias.toFixed(2) }}</span>
                        </label>
                        <USlider
                            v-model="narrativeHandedBias"
                            :min="0"
                            :max="0.8"
                            :step="0.02"
                            :ui="{ thumb: 'bg-primary' }"
                            :disabled="!narrativeEnabled"
                        />
                    </div>

                    <div class="flex items-center gap-3">
                        <UCheckbox
                            v-model="narrativeAutoStage"
                            id="narrative-autostage"
                            :disabled="!narrativeEnabled"
                        />
                        <label for="narrative-autostage" class="text-primary font-semibold cursor-pointer">
                            Auto-stage (driven by build progress)
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <div class="relative rounded-lg w-full h-[600px] bg-black" ref="canvasContainer">
            <!-- Controls overlay -->
            <div v-show="showControlsOverlay" class="absolute top-4 left-4 z-10 flex flex-col gap-1 opacity-60">
                <div class="flex gap-4">
                    <div class="flex flex-col gap-2">
                        <span class="text-white font-bold">Navigation</span>
                        <div class="border border-white/60 rounded-md p-3 flex flex-col gap-3 mb-2">
                            <!-- WASD keys -->
                            <div class="flex flex-col items-start gap-1">
                                <!-- Top row: W (offset to align with S) -->
                                <kbd class="overlay-kbd overlay-kbd-lg ml-9">W</kbd>
                                <!-- Bottom row: A S D -->
                                <div class="flex gap-1">
                                    <kbd class="overlay-kbd overlay-kbd-lg">A</kbd>
                                    <kbd class="overlay-kbd overlay-kbd-lg">S</kbd>
                                    <kbd class="overlay-kbd overlay-kbd-lg">D</kbd>
                                </div>
                            </div>

                            <!-- Arrow keys -->
                            <div class="flex flex-col items-start gap-1">
                                <!-- Top row: Up (offset to align with Down) -->
                                <kbd class="overlay-kbd overlay-kbd-lg ml-9">
                                    <UIcon name="mingcute-arrow-up-line" class="text-white size-4" />
                                </kbd>
                                <!-- Bottom row: Left Down Right -->
                                <div class="flex gap-1">
                                    <kbd class="overlay-kbd overlay-kbd-lg">
                                        <UIcon name="mingcute-arrow-left-line" class="text-white size-4" />
                                    </kbd>
                                    <kbd class="overlay-kbd overlay-kbd-lg">
                                        <UIcon name="mingcute-arrow-down-line" class="text-white size-4" />
                                    </kbd>
                                    <kbd class="overlay-kbd overlay-kbd-lg">
                                        <UIcon name="mingcute-arrow-right-line" class="text-white size-4" />
                                    </kbd>
                                </div>
                            </div>

                            <div class="flex gap-1">
                                <kbd class="overlay-kbd overlay-kbd-lg !w-13 !justify-start pl-1.25"
                                    ><span class="scale-170 translate-y-[1px]">⇧</span></kbd
                                >
                                <kbd class="overlay-kbd overlay-kbd-lg text-[0.5rem] !w-22">SPC</kbd>
                            </div>

                            <!-- Mouse / Touch -->
                            <div class="flex items-center gap-2">
                                <UIcon name="mingcute-mouse-line" class="text-white size-9" />
                                <div class="w-px h-5 bg-white/50"></div>
                                <UIcon name="mingcute-finger-swipe-line" class="text-white size-9" />
                            </div>
                            <div class="flex items-center gap-2 mb-2">
                                <kbd class="overlay-kbd overlay-kbd-sm">[</kbd>
                                <UIcon
                                    :name="
                                        movement.speedIndex.value >= 0
                                            ? 'mingcute-tag-chevron-fill'
                                            : 'mingcute-tag-chevron-line'
                                    "
                                    class="text-white size-4"
                                />
                                <UIcon
                                    :name="
                                        movement.speedIndex.value >= 1
                                            ? 'mingcute-tag-chevron-fill'
                                            : 'mingcute-tag-chevron-line'
                                    "
                                    class="text-white size-4"
                                />
                                <UIcon
                                    :name="
                                        movement.speedIndex.value >= 2
                                            ? 'mingcute-tag-chevron-fill'
                                            : 'mingcute-tag-chevron-line'
                                    "
                                    class="text-white size-4"
                                />
                                <kbd class="overlay-kbd overlay-kbd-sm">]</kbd>
                            </div>
                        </div>
                        <span class="text-white font-bold">Rendering Options</span>
                        <div class="border border-white/60 rounded-md p-3 mb-4 flex flex-col gap-3">
                            <div class="flex items-center gap-2">
                                <span class="text-white/80 text-s">Render Mode</span>
                                <kbd class="overlay-kbd overlay-kbd-sm">R</kbd>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-white/80 text-s">Oscillation</span>
                                <kbd class="overlay-kbd overlay-kbd-sm">O</kbd>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-white text-s font-bold">Hide Overlay</span>
                            <kbd class="overlay-kbd overlay-kbd-sm">H</kbd>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex flex-col items-start gap-2">
                            <span class="text-white font-bold">Play/Pause</span>
                            <kbd class="overlay-kbd overlay-kbd-lg text-[0.5rem] !w-22 mb-2" aria-label="Enter">
                                ENTER
                                <span class="ml-1 text-2xl translate-y-[-3px]">↵</span>
                            </kbd>

                            <div class="flex items-center gap-2">
                                <span class="text-white font-bold">Camera mode</span>
                                <kbd class="overlay-kbd overlay-kbd-sm">C</kbd>
                            </div>
                            <kbd
                                class="overlay-kbd overlay-kbd-lg text-[0.5rem] !w-30 !h-12 mb-2 !justify-start pl-2 gap-2"
                                aria-label="Camera"
                            >
                                <UIcon name="mingcute-camcorder-line" class="text-white size-8" />
                                <span>{{ cameraMode.charAt(0).toUpperCase() + cameraMode.slice(1) }}</span>
                            </kbd>
                        </div>
                    </div>
                </div>
            </div>

            <UButton
                v-if="showControlsOverlay"
                class="absolute top-4 right-0 z-10"
                color="primary"
                variant="solid"
                size="xl"
                :icon="three.isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
                @click="three.toggleFullscreen"
                :aria-label="three.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
            />
        </div>
    </div>
</template>

<style scoped>
.overlay-kbd {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid white;
    border-radius: 0.25rem;
}

.overlay-kbd-lg {
    width: 2rem;
    height: 2rem;
    color: white;
    font-size: 0.875rem;
    font-family: ui-monospace, monospace;
}

.overlay-kbd-sm {
    width: 1.25rem;
    height: 1.25rem;
    color: white;
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
}
</style>
