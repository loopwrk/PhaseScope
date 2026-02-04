<script setup lang="ts">
import * as THREE from "three";
import {
    analyzeFrequencyBand,
    freqContentToHz,
    ampToOscillationRange
} from "~/utils/audio/analysis";
import type { RenderMode } from "~/composables/useCorridorRenderer.client";

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
}

const renderMode = ref<RenderMode>('points');

const canvasContainer = ref<HTMLDivElement | null>(null);
const three = useThree(canvasContainer);
const scene = three.scene;

// Initialize corridor renderer
const renderer = useCorridorRenderer(scene);

type CameraMode = 'free' | 'follow' | 'orbit';
const cameraMode = ref<CameraMode>('follow');
const toast = useToast();

const movement = useKeyboardMovement(three.controls, {
    onMovement: () => {
        cameraMode.value = 'free';
    }
});


usePointerLockCamera(three.controls, canvasContainer, {
    onLock: () => {
        // Disable auto-follow when user takes manual camera control
        cameraMode.value = 'free';
    }
});

let requestAnimFrame: number | null = null;

const initaliseScene = () => {
    three.init();
};

// Initialize WAV player composable
const { audio, wavLoaded, loadWavFile: loadWavFileBase, startAudio, stopAllAudio, pauseAudio, resumeAudio, getPlaybackTimeSeconds, dispose: disposeWavPlayer } = useWavPlayer();

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
});

const oscillationEnabled = ref(false);
const showControlsOverlay = ref(true);

// Track coverage as percentage (0-100)
const trackCoveragePercent = ref(100);

const corridorMeta = ref({
    zStep: 0.08, // distance between frames along Z axis
    pointsPerFrame: 128,
    windowSize: 2048, // samples per frame window
    hopSize: 1024,    // samples between frames
});

// Performance warning thresholds
const POINTS_WARNING_THRESHOLD = 3_000_000;
const POINTS_DANGER_THRESHOLD = 8_000_000;

// Calculate total frames possible for the loaded audio
const totalFramesForTrack = computed(() => {
    if (!audio.buffer) return 0;
    const { windowSize, hopSize } = corridorMeta.value;
    return Math.floor((audio.buffer.length - windowSize) / hopSize);
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
}

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

    // Create geometries using renderer
    const { positions } = renderer.createGeometry({
        totalPoints,
        renderMode,
        pointsPosition: { x: 0, y: 1.7, z: 0.95 },
        linesPosition: { x: 0, y: 1.7, z: 0 }
    });

    corridorState.value.pos = positions;
}

const loadWavFile = async (file: File) => {
    stopAllAudio();
    clearCorridor();

    await loadWavFileBase(file);

    // Build the 3D snapshot corridor progressively as playback advances
    if (audio.buffer) {
        initLiveSnapshotCorridor(audio.buffer);
    }

    cameraMode.value = 'follow';
}

const onAudioLoadError = (error: Error) => {
    toast.add({
        title: 'Failed to load audio',
        description: error.message,
        color: 'error',
        icon: 'i-heroicons-exclamation-triangle',
    });
}

const handlePlay = async () => {
    // Re-initialize corridor if it was cleared but audio buffer still exists
    if (audio.buffer && !corridorState.value.buffer) {
        initLiveSnapshotCorridor(audio.buffer);
        cameraMode.value = 'follow';
    }

    // If paused (started but no active source), resume from saved position
    if (audio.started && !audio.source) {
        await resumeAudio();
    } else {
        await startAudio();
    }
}

const handlePause = () => {
    pauseAudio();
}

const handlePlayPause = async () => {
    if (audio.source) {
        handlePause();
    } else {
        await handlePlay();
    }
}

const handleStop = () => {
    stopAllAudio();
    clearCorridor();
}

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
}

const buildOneCorridorFrame = (frameIndex: number) => {
    // Writes a single frame into the preallocated positions buffer.
    const { pointsPerFrame, windowSize, hopSize, zStep } = corridorMeta.value;
    const { ch0, ch1, frameCount, xyScale, ringRadius, pos, frequencies, amplitudes, anchorPositions } = corridorState.value;
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
    // Low frequencies (bass) = RED (hue 0.0)
    // Mid frequencies = YELLOW/GREEN (hue 0.33)
    // High frequencies (treble) = BLUE/MAGENTA (hue 0.75)
    const hueRangeMultiplier = 0.75;
    const hue = freqContent * hueRangeMultiplier;
    const saturation = 0.85;
    const baseLightness = 0.35;
    const amplitudeBrightnessFactor = 0.5;

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
        const localFreqContent = localTotal > 0.001
            ? clamp(Math.sqrt(localChangeEnergy) / localTotal * 3, 0, 1)
            : 0.5;
        const pointFreqHz = freqContentToHz(localFreqContent);

        // Lightness varies per point based on amplitude
        const lightness = baseLightness + normalizedAmp * amplitudeBrightnessFactor;
        color.setHSL(hue, saturation, lightness);

        // Stable 3D: wrap around a ring so each frame becomes a "floating wreath" you can walk through
        const ringX = Math.cos(u) * ringRadius;
        const ringZ = Math.sin(u) * ringRadius;

        pos[p] = ringX + x2;
        pos[p + 1] = y2;        // portrait controls vertical shape
        pos[p + 2] = ringZ + z0; // time corridor

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
}

const oscillateExistingPoints = (time: number) => {
    // Apply oscillation to all built points based on their stored frequency data
    const { pos, frequencies, amplitudes, anchorPositions, builtFrames } = corridorState.value;
    const { pointsPerFrame } = corridorMeta.value;

    if (!pos || !frequencies || !amplitudes || !anchorPositions) return;
    if (builtFrames === 0) return;

    const totalBuiltPoints = builtFrames * pointsPerFrame;

    for (let i = 0; i < totalBuiltPoints; i++) {
        const positionArrayStride = 3;
        const p = i * positionArrayStride;
        const freq = frequencies[i] ?? 0;
        const amp = amplitudes[i] ?? 0;

        // Calculate oscillation using sine wave at the point's frequency
        // Use slight phase offsets for each axis to create 3D motion
        const phaseCalcMultiplier = 2;
        const phaseShiftY = Math.PI / 3; // 60° phase offset for Y-axis
        const phaseShiftZ = 2 * Math.PI / 3; // 120° phase offset for Z-axis
        const phase = phaseCalcMultiplier * Math.PI * freq * time;
        const oscX = Math.sin(phase) * amp;
        const oscY = Math.sin(phase + phaseShiftY) * amp;
        const oscZ = Math.sin(phase + phaseShiftZ) * amp;

        // Update position by adding oscillation to anchor position
        pos[p] = (anchorPositions[p] ?? 0) + oscX;
        pos[p + 1] = (anchorPositions[p + 1] ?? 0) + oscY;
        pos[p + 2] = (anchorPositions[p + 2] ?? 0) + oscZ;
    }

    // Mark geometry for update
    renderer.markGeometryForUpdate(true, false);
}

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
        buildOneCorridorFrame(f);
        corridorState.value.builtFrames++;
    }

    const builtPoints = corridorState.value.builtFrames * corridorMeta.value.pointsPerFrame;

    // Update geometry
    renderer.updateDrawRange(builtPoints);
    renderer.markGeometryForUpdate(true, true);
}

const updateAutoFollowCamera = (time: number) => {
    if (cameraMode.value === 'free' || !renderer.hasGeometry() || !corridorState.value.buffer) return;

    // Calculate the Z position of the corridor head (latest built frame)
    const headFrameIndex = corridorState.value.builtFrames - 1;
    if (headFrameIndex < 0) return;

    const frameCenteringDivisor = 2;
    const headZ = (headFrameIndex - corridorState.value.frameCount / frameCenteringDivisor) * corridorMeta.value.zStep;
    const galleryY = 1.7; // gallery.position.y

    const camObj = three.controls.value?.object;
    if (!camObj) return;

    const lerpFactor = 0.1;
    let targetPos: { x: number; y: number; z: number };

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
            z: headZ + Math.sin(horizontalAngle) * orbitRadius
        };
    } else {
        // Follow mode: isometric angle behind and above the head
        const offset = {
            x: 5.0,   // to the side
            y: 4.5,   // above
            z: 7.0    // behind the head
        };

        targetPos = {
            x: offset.x,
            y: galleryY + offset.y,
            z: headZ + offset.z
        };
    }

    // Smooth camera movement
    camObj.position.x += (targetPos.x - camObj.position.x) * lerpFactor;
    camObj.position.y += (targetPos.y - camObj.position.y) * lerpFactor;
    camObj.position.z += (targetPos.z - camObj.position.z) * lerpFactor;

    // Look at the corridor head
    const lookTarget = new THREE.Vector3(0, galleryY, headZ);
    three.camera.value?.lookAt(lookTarget);
}


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
        if (oscillationEnabled.value) {
            oscillateExistingPoints(timeInSeconds);
        }
    }

    const r = three.renderer.value;
    const c = three.camera.value;
    if (r && c) r.render(scene, c);
    requestAnimFrame = requestAnimationFrame(animate);
}

// Watch for render mode changes and update visibility
watch(renderMode, (newMode) => {
    renderer.setRenderMode(newMode);
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
    oscillationEnabled.value = !oscillationEnabled.value;
});
shortcuts.register('f', () => {
    three.toggleFullscreen();
});
shortcuts.register(' ', () => {
    handlePlayPause();
});
shortcuts.register('h', () => {
    showControlsOverlay.value = !showControlsOverlay.value;
});
shortcuts.register('c', () => {
    toggleCameraMode();
});

onMounted(() => {
    initaliseScene();
    requestAnimFrame = requestAnimationFrame(animate);
});

onUnmounted(async () => {
    if (requestAnimFrame !== null) {
        cancelAnimationFrame(requestAnimFrame);
        requestAnimFrame = null;
    }

    await disposeWavPlayer();
    clearCorridor();
    three.dispose();
});

</script>

<template>
    <div>
        <ProseH1>Serpentoscope</ProseH1>
        <ProseH2>Where Sound Draws Coils Through Explorable Space (prototype) WIP</ProseH2>

        <div class="flex items-center mb-6">
            <PlayPauseButton :is-playing="!!audio.source" :disabled="!wavLoaded" @click="handlePlayPause" />
            <StopButton :disabled="!audio.started" @click="handleStop" />
            <AudioLoaderButton :handler="loadWavFile" @error="onAudioLoadError">
                Load WAV
            </AudioLoaderButton>
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
                        <USlider v-model="corridorMeta.pointsPerFrame" :min="32" :max="512" :step="32"
                            :ui="{ thumb: 'bg-primary' }" :disabled="audio.started || !wavLoaded" />
                    </div>
                    <div class="mb-6" :class="{ 'opacity-40': audio.started || !wavLoaded }">
                        <label class="block font-bold text-primary text-lg mb-2">
                            Track Coverage: <span class="text-secondary">{{ trackCoveragePercent }}%</span>
                            <span v-if="wavLoaded" class="text-sm font-normal ml-2 text-gray-500">
                                ({{ formatPointCount(effectiveMaxPoints) }} points)
                            </span>
                        </label>
                        <USlider v-model="trackCoveragePercent" :min="10" :max="100" :step="5"
                            :ui="{ thumb: 'bg-primary' }" :disabled="audio.started || !wavLoaded" />
                        <p v-if="!wavLoaded" class="text-sm text-gray-400 mt-1">
                            Load a WAV file to enable this setting
                        </p>
                    </div>
                    <!-- Points warning -->
                    <div v-if="wavLoaded && pointsWarningLevel !== 'none'"
                        class="p-3 rounded-md mb-4 bg-white border border-[color:var(--ui-warning)]">
                        <div class="flex items-start gap-2">
                            <UIcon
                                name="i-heroicons-exclamation-triangle"
                                class="size-5 mt-0.5 flex-shrink-0 text-[color:var(--ui-warning)]" />
                            <div>
                                <p class="font-semibold text-sm text-[color:var(--ui-warning)]">
                                    {{ pointsWarningLevel === 'danger' ? 'High Performance Risk' : 'Performance Warning' }}
                                </p>
                                <p class="text-sm text-[color:var(--ui-text)] mt-1">
                                    {{ formatPointCount(effectiveMaxPoints) }} points may
                                    {{ pointsWarningLevel === 'danger' ? 'cause significant lag or crashes' : 'impact performance' }}
                                    on some devices. Consider reducing track coverage or points per frame.
                                </p>
                            </div>
                        </div>
                    </div>
                    <USeparator class="py-2" />
                    <div class="mb-6">
                        <URadioGroup v-model="renderMode" size="xl" :items="[
                            { label: 'Points', value: 'points' },
                            { label: 'Lines', value: 'lines' }
                        ]" :ui="{ legend: 'text-lg text-primary font-bold', label: 'text-primary' }" value-key="value"
                            orientation="horizontal">
                            <template #legend>
                                <span class="inline-flex items-center gap-2">
                                    Render Mode
                                    <UKbd size="md"
                                        class="bg-primary text-white text-sm font-semibold ring-0 shadow-none cursor-default">
                                        R
                                    </UKbd>
                                </span>
                            </template>
                        </URadioGroup>
                    </div>
                    <USeparator class="py-2" />
                    <div class="flex items-center gap-3 mb-2">
                        <UCheckbox v-model="oscillationEnabled" id="oscillation-toggle" />
                        <label for="oscillation-toggle"
                            class="text-primary text-lg font-bold cursor-pointer inline-flex items-center gap-2">
                            Enable Point Oscillation
                            <UKbd size="md"
                                class="bg-primary text-white text-sm font-semibold ring-0 shadow-none cursor-default">
                                O
                            </UKbd>
                        </label>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="flex-1 space-y-4">
                    <div class="flex items-center gap-3 mb-2">
                        <UCheckbox v-model="showControlsOverlay" id="controls-overlay-toggle" />
                        <label for="controls-overlay-toggle"
                            class="text-primary text-lg font-bold cursor-pointer inline-flex items-center gap-2">
                            Show Controls Overlay
                            <UKbd size="md"
                                class="bg-primary text-white text-sm font-semibold ring-0 shadow-none cursor-default">
                                H
                            </UKbd>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <div class="relative rounded-lg w-full h-[600px] bg-black" ref="canvasContainer">
            <!-- Controls overlay -->
            <div v-show="showControlsOverlay" class="absolute top-4 left-4 z-10 flex flex-col gap-4 opacity-60">
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

                <!-- Mouse / Touch -->
                <div class="flex items-center gap-2 mt-4">
                    <UIcon name="mingcute-mouse-line" class="text-white size-10" />
                    <div class="w-px h-5 bg-white/50"></div>
                    <UIcon name="mingcute-finger-swipe-line" class="text-white size-10" />
                </div>

                <!-- Keyboard shortcuts -->
                <div class="flex flex-col gap-1 mt-4">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-white/80 text-s">Render Mode</span>
                        <kbd class="overlay-kbd overlay-kbd-sm">R</kbd>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-white/80 text-s">Point Oscillation</span>
                        <kbd class="overlay-kbd overlay-kbd-sm">O</kbd>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-white/80 text-s">Hide Overlay</span>
                        <kbd class="overlay-kbd overlay-kbd-sm">H</kbd>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-white/80 text-s">Speed Boost</span>
                        <kbd class="overlay-kbd overlay-kbd-sm !justify-start pl-1"
                            style="font-size: 1.2rem; width: 2rem;"><span
                                style="transform: translateY(-1px); display: inline-block;">⇧</span></kbd>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-white/80 text-s">Camera: {{ cameraMode }}</span>
                        <kbd class="overlay-kbd overlay-kbd-sm">C</kbd>
                    </div>
                </div>
            </div>

            <UButton class="absolute top-4 right-0 z-10" color="primary" variant="solid" size="xl"
                :icon="three.isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
                @click="three.toggleFullscreen"
                :aria-label="three.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'" />
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
