<script setup lang="ts">
import { toRaw } from 'vue';
import { useMediaQuery } from '@vueuse/core';

// Full-bleed canvas dashboard - opt out of the default site chrome (header /
// container / footer); this page paints the whole viewport itself.
definePageMeta({ layout: false });

// Desktop shows the side panels by default; phones start with them collapsed
// (they overlay the canvas) and the user opens them from the header.
const isDesktop = useMediaQuery('(min-width: 768px)');

/* ---------- Engine assembly ----------
   The page is wiring: scene plumbing (useThree + renderer + backgrounds),
   the geometry engine (usePhaseGeometry), the camera brain (useAutoCamera)
   and the playback orchestrator (usePlaybackOrchestration), joined by the
   render loop below. All engine behaviour lives in the composables. */

// User settings survive navigation (e.g. /about and back) via useState -
// see useScopeSettings for the full key inventory.
const settings = useScopeSettings();
const { renderMode, topologyMode, showGoniometer, advancedOptionsOpen } = settings;
const canvasContainer = ref<HTMLDivElement | null>(null);

const three = useThree(canvasContainer);
const scene = three.scene;
const renderer = useCorridorRenderer(scene);
const dreamBg = useDreamBackground(scene, settings.dreamBgEnabled);
const heavenlyBg = useHeavenlyBackground(scene, settings.heavenlyBgEnabled);

// 3D Lissajous scope mode: the live phase portrait in a cube, no time axis.
// Entered by clicking the goniometer; the corridor hides while it is active.
const scope3d = ref(false);

const player = useWavPlayer();
const geometry = usePhaseGeometry({ renderer, renderMode, topologyMode, audio: player.audio });
const camera = useAutoCamera({
    three,
    renderer,
    geometry,
    topologyMode,
    wavLoaded: player.wavLoaded,
    lissajousActive: scope3d,
    lissajousDimension: usePersistedState<'3d' | '2d'>('scope:liss-dimension', () => '3d'),
});
const playback = usePlaybackOrchestration({ three, geometry, camera, topologyMode, player });

// Flat bindings for the template
const {
    corridorState,
    corridorMeta,
    trackCoveragePercent,
    useAlternateColors,
    channelBias,
    effectiveMaxPoints,
    pointsWarningLevel,
    formatPointCount,
} = geometry;
const { cameraMode, setCameraMode, toggleCameraMode } = camera;
const {
    audio,
    wavLoaded,
    getPlaybackTimeSeconds,
    elapsedLabel,
    sortedDemoTracks,
    demoTracksLoading,
    selectedDemoTrackId,
    handlePlayPause,
    handleStop,
    handleSelectDemoTrack,
    handleLoadFile,
    playAdjacentTrack,
    initMediaSessionHandlers,
    dispose: disposePlayback,
} = playback;

// Manual camera input: WASD movement and pointer lock both hand the camera
// to the user (auto-follow disengages via cameraMode = 'free') - EXCEPT in
// the scope's 2D view, which is dolly-only with the gaze locked.
const scope2dLocked = computed(() => scope3d.value && lissajous.dimension.value === '2d');

const movement = useKeyboardMovement(three.controls, {
    dollyOnly: scope2dLocked,
    onMovement: () => {
        if (!scope2dLocked.value) cameraMode.value = 'free';
    },
});

usePointerLockCamera(three.controls, canvasContainer, {
    disabled: scope2dLocked,
    onLock: () => {
        // Disable auto-follow when user takes manual camera control
        cameraMode.value = 'free';
    },
});

// Set movement speed level directly (slow / medium / fast = 0 / 1 / 2).
const setMovementSpeed = (index: number) => {
    movement.speedIndex.value = Math.min(2, Math.max(0, index));
};

// Point oscillation controls - the displacement itself runs in the vertex
// shader, driven by renderer.setOscillation() in the render loop below.
const oscillation = useOscillation();

// Points <-> lines visibility
watch(renderMode, (newMode) => {
    renderer.setRenderMode(newMode);
});

/* ---------- Floating panels (UI state) ---------- */

const showControlsOverlay = ref(true);
const showSettings = ref(true);

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

/* ---------- Goniometer HUD ---------- */

// Pull-based source: the component samples this inside its own ~30fps rAF
// loop (no reactive churn, no contact with the WebGL path). Shows the
// window at the playhead whether playing or paused - a scope reads
// whatever is at the probe.
const goniometerSource = () => {
    const raw = toRaw(corridorState.value);
    if (!raw.ch0 || !raw.ch1 || !raw.buffer) return null;
    return { ch0: raw.ch0, ch1: raw.ch1, index: Math.floor(getPlaybackTimeSeconds() * raw.sr), sr: raw.sr };
};

const lissajous = useLissajous3D(three, goniometerSource);
watch(scope3d, (active) => {
    lissajous.active.value = active;
    renderer.setCorridorVisible(!active);
});

/* ---------- Background skyboxes (mutually exclusive) ---------- */

const onDreamBgToggle = () => {
    if (dreamBg.enabled.value) heavenlyBg.enabled.value = false;
};
const onHeavenlyBgToggle = () => {
    if (heavenlyBg.enabled.value) dreamBg.enabled.value = false;
};

/* ---------- Keyboard shortcuts ---------- */

const shortcuts = useKeyboardShortcuts();
shortcuts.register('r', () => {
    if (channelBias.value) return; // lines unavailable while the field is split
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
    onDreamBgToggle();
});
shortcuts.register('n', () => {
    heavenlyBg.enabled.value = !heavenlyBg.enabled.value;
    onHeavenlyBgToggle();
});
shortcuts.register('g', () => {
    showGoniometer.value = !showGoniometer.value;
});
shortcuts.register('{', () => playAdjacentTrack(-1));
shortcuts.register('}', () => playAdjacentTrack(1));

/* ---------- Render loop ---------- */

let requestAnimFrame: number | null = null;
let lastFrameTime = 0;

const animate = (now: number) => {
    // Calculate delta time (capped at 33ms to avoid large jumps)
    const maxDeltaTime = 0.033;
    const dt = Math.min(maxDeltaTime, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    movement.update(dt);

    if (renderer.hasGeometry()) {
        const timeInSeconds = now / 1000;
        // Build points progressively as playback advances
        geometry.updateProgressiveBuild(getPlaybackTimeSeconds());
        // Update camera based on current mode
        camera.update(timeInSeconds);
        // Drive the GPU oscillation (four uniform writes; the displacement
        // happens in the vertex shader, off the CPU entirely)
        renderer.setOscillation({
            time: timeInSeconds,
            mode: oscillation.enabled.value ? oscillation.mode.value : 'off',
            builtFrames: corridorState.value.builtFrames,
            pointsPerFrame: corridorMeta.value.pointsPerFrame,
        });
    }

    if (scope3d.value) lissajous.update();

    const r = three.renderer.value;
    const c = three.camera.value;
    dreamBg.update(now / 1000, c?.position);
    heavenlyBg.update(now / 1000, c?.position);
    if (r && c) r.render(scene, c);
    requestAnimFrame = requestAnimationFrame(animate);
};

/* ---------- Lifecycle ---------- */

onMounted(() => {
    three.init();
    initMediaSessionHandlers();
    requestAnimFrame = requestAnimationFrame(animate);

    // Dev-only escape hatch for inspecting the live engine from the console
    if (import.meta.dev) {
        (window as unknown as Record<string, unknown>).__scope = { three, renderer, geometry, oscillation };
    }
});

onUnmounted(async () => {
    if (requestAnimFrame !== null) {
        cancelAnimationFrame(requestAnimFrame);
        requestAnimFrame = null;
    }

    await disposePlayback();
    lissajous.dispose();
    dreamBg.dispose();
    heavenlyBg.dispose();
    three.dispose();
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
                v-model:channel-bias="channelBias"
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
                    <LayoutAdvancedPanel v-model:open="advancedOptionsOpen" v-model:mode="oscillation.mode.value" />
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

        <!-- Bottom-left: goniometer HUD (the instantaneous phase portrait)
             plus, while the 3D scope is active, its settings rising above. -->
        <!-- On short windows the panel sits beside the goniometer instead of
             above it, so the stack never reaches the header/logo -->
        <div
            v-if="showGoniometer && wavLoaded"
            class="absolute bottom-5 left-5 z-20 hidden flex-col items-start gap-3 md:flex [@media(max-height:880px)]:flex-row [@media(max-height:880px)]:items-end"
        >
            <LayoutScopeSettingsPanel
                v-if="scope3d"
                class="ps-rise max-h-[calc(100svh_-_8rem)] overflow-y-auto"
                v-model:dimension="lissajous.dimension.value"
                v-model:line-width="lissajous.lineWidth.value"
                v-model:colour-mode="lissajous.colourMode.value"
                v-model:custom-colour="lissajous.customColour.value"
            />
            <LayoutGoniometer
                class="ps-rise"
                :source="goniometerSource"
                :active3d="scope3d"
                @toggle3d="scope3d = !scope3d"
            />
        </div>

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
                @load-file="handleLoadFile"
                @select-track="handleSelectDemoTrack"
            />
        </main>
    </div>
</template>
