<script setup lang="ts">
import * as THREE from "three";
import {
    type FrequencyResolution,
    getAnalysisWindowSize,
    analyzeFrequencyBand,
    freqContentToHz,
    ampToOscillationRange
} from "~/utils/audio/analysis";
import type { RenderMode } from "~/composables/useCorridorRenderer.client";

const renderMode = ref<RenderMode>('points');

const canvasContainer = ref<HTMLDivElement | null>(null);
const three = useThree(canvasContainer);
const scene = three.scene;

// Initialize corridor renderer
const renderer = useCorridorRenderer(scene);

const autoFollowEnabled = ref(true);
const toast = useToast();

const movement = useKeyboardMovement(three.controls, {
    onMovement: () => {
        autoFollowEnabled.value = false;
    }
});


const pointerLock = usePointerLockCamera(three.controls, canvasContainer, {
    onLock: () => {
        // Disable auto-follow when user takes manual camera control
        autoFollowEnabled.value = false;
    }
});

let requestAnimFrame: number | null = null;

const initaliseScene = () => {
    three.init();
};

// Initialize WAV player composable
const { audio, wavLoaded, loadWavFile: loadWavFileBase, startAudio, stopAllAudio, pauseAudio, resumeAudio, getPlaybackTimeSeconds, dispose: disposeWavPlayer } = useWavPlayer();

const corridorState = ref({
    buffer: null as AudioBuffer | null,
    sr: 0,
    ch0: null as Float32Array | null,
    ch1: null as Float32Array | null,
    frameCount: 0,
    xyScale: 1.8,
    ringRadius: 1.8,
    // how many frames have been written into the positions buffer
    builtFrames: 0,
    // array backing the Points geometry
    pos: null as Float32Array | null,
    // Oscillation data
    frequencies: null as Float32Array | null,
    amplitudes: null as Float32Array | null,
    anchorPositions: null as Float32Array | null,
});

const oscillationEnabled = ref(false);

// Import audio analysis utilities
const frequencyResolution = ref<FrequencyResolution>('balanced');

const corridorMeta = ref({
    zStep: 0.08, // distance between frames along Z axis
    pointsPerFrame: 128,
    windowSize: 2048, // samples per frame window
    hopSize: 1024,    // samples between frames
    maxPoints: 1500000, // cap total points for performance (instead of fixed frame count)
});

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

    const { windowSize, hopSize, pointsPerFrame, maxPoints } = corridorMeta.value;
    const totalFrames = Math.floor((ch0.length - windowSize) / hopSize);
    // Calculate max frames based on point budget instead of arbitrary frame limit
    const maxFrames = Math.floor(maxPoints / pointsPerFrame);
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
    const { positions, colors } = renderer.createGeometry({
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

    // Enable auto-follow camera mode
    autoFollowEnabled.value = true;
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
        autoFollowEnabled.value = true;
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

    for (let k = 0; k < pointsPerFrame; k++) {
        const u = (k / pointsPerFrame) * Math.PI * 2;
        const sampleIndex = frameStart + Math.floor((k / pointsPerFrame) * windowSize);
        const i = clamp(sampleIndex, 0, ch0.length - 1);

        const L = ch0[i] ?? 0;
        const R = ch1[i] ?? 0;

        // Core portrait (XY)
        const x2 = L * xyScale;
        const y2 = R * xyScale;

        // Calculate amplitude for brightness
        const amplitude = Math.sqrt(L * L + R * R);
        const normalizedAmp = clamp(amplitude, 0, 1);

        // Analyze frequency content in a small window around this sample
        const analysisWindow = getAnalysisWindowSize(frequencyResolution.value);
        const windowCenteringCalc = 2;
        const windowStart = Math.max(0, i - analysisWindow / windowCenteringCalc);

        // Analyze both channels and average
        const freqL = analyzeFrequencyBand(ch0, windowStart, analysisWindow);
        const freqR = analyzeFrequencyBand(ch1, windowStart, analysisWindow);
        const channelAverage = 2;
        const freqContent = (freqL + freqR) / channelAverage; // 0 = low freq, 1 = high freq

        // Map frequency to color with FULL spectrum range:
        // Low frequencies (bass) = RED (hue 0.0)
        // Mid frequencies = YELLOW/GREEN (hue 0.33)
        // High frequencies (treble) = BLUE/MAGENTA (hue 0.75)
        const color = new THREE.Color();
        const hueRangeMultiplier = 0.75;
        const hue = freqContent * hueRangeMultiplier; // Full spectrum: Red -> Orange -> Yellow -> Green -> Cyan -> Blue -> Magenta
        const hslColourSaturation = 0.85;
        const saturation = hslColourSaturation; // High saturation for vivid colors
        const baseLightness = 0.35
        const amplitudeBrightnessFactor = 0.5;
        const lightness = baseLightness + normalizedAmp * amplitudeBrightnessFactor; // Amplitude affects brightness only
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

        // Convert freqContent (0-1) to Hz using logarithmic scale
        frequencies[pointIndex] = freqContentToHz(freqContent);

        // Store amplitude (scale to reasonable oscillation range: 0.005 to 0.05 units)
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

const updateAutoFollowCamera = () => {
    if (!autoFollowEnabled.value || !renderer.hasGeometry() || !corridorState.value.buffer) return;

    // Calculate the Z position of the corridor head (latest built frame)
    const headFrameIndex = corridorState.value.builtFrames - 1;
    if (headFrameIndex < 0) return;

    const frameCenteringDivisor = 2; // to center the head frame
    const headZ = (headFrameIndex - corridorState.value.frameCount / frameCenteringDivisor) * corridorMeta.value.zStep;
    const galleryY = 1.7; // gallery.position.y

    // Position camera at an isometric angle: behind, above, and to the side of the head
    const offset = {
        x: 5.0,   // to the side
        y: 4.5,   // above
        z: 7.0    // behind the head
    };

    const targetPos = {
        x: offset.x,
        y: galleryY + offset.y,
        z: headZ + offset.z
    };

    // Smooth camera movement
    const camObj = three.controls.value?.object;
    if (!camObj) return;
    const lerpFactor = 0.1;
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
        // Auto-follow the corridor head if enabled
        updateAutoFollowCamera();
        // Apply oscillation to existing points if enabled
        const milliSecToSec = now / 1000;
        if (oscillationEnabled.value) {
            oscillateExistingPoints(milliSecToSec);
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
                    <div class="mb-6">
                        <label class="block font-bold text-primary text-lg mb-2">
                            Points Per Frame: <span class="text-secondary">{{ corridorMeta.pointsPerFrame }}</span>
                        </label>
                        <USlider v-model="corridorMeta.pointsPerFrame" :min="32" :max="512" :step="32"
                            :ui="{ thumb: 'bg-primary' }" :disabled="audio.started" />
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
                    <div>
                        <URadioGroup v-model="frequencyResolution" legend="Frequency Analysis Resolution" size="xl"
                            :items="[
                                {
                                    label: 'Hi-Res',
                                    value: 'spectral',
                                    help: 'Detailed frequency analysis. Best for sustained tones, classical and ambient.'
                                },
                                {
                                    label: 'Mid',
                                    value: 'balanced',
                                    help: 'Balanced time/frequency resolution. Good for most music genres.'
                                },
                                {
                                    label: 'Lo-Res',
                                    value: 'temporal',
                                    help: 'Fast response to changes. Best for percussion and electronic.'
                                }
                            ]" :ui="{ legend: 'text-lg text-primary font-bold', label: 'text-primary' }"
                            value-key="value" :disabled="audio.started">
                            <template #label="{ item }">
                                <div class="flex flex-col gap-1">
                                    <span class="font-bold text-primary">{{ item.label }}</span>
                                    <span class="text-sm text-primary dark:text-gray-400">{{ item.help }}</span>
                                </div>
                            </template>
                        </URadioGroup>
                    </div>
                </div>
            </div>
        </div>

        <div class="relative rounded-lg w-full h-[600px] bg-black" ref="canvasContainer">
            <UButton class="absolute top-4 right-0 z-10" color="primary" variant="solid" size="xl"
                :icon="three.isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
                @click="three.toggleFullscreen"
                :aria-label="three.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'" />
        </div>
    </div>
</template>
