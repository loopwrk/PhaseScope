<script setup lang="ts">
import { toRaw } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import type { LivePhase } from '~/composables/useLiveSession.client';
import type { BackgroundId } from '~/composables/useScopeSettings';

// Full-bleed canvas dashboard
definePageMeta({ layout: false });

// The home page needs its own title/description so client-side navigation
// back here (e.g. closing /about) resets the document head - without it,
// the previous page's title would persist on the tab.
useSeoMeta({
    title: 'PhaseScope - See the shape of your music',
    description:
        'PhaseScope turns any stereo track into a luminous 3D structure you can fly through - a real-time, in-browser audio visualiser built from the sound itself, coloured by pitch. Play it live with a MIDI keyboard, too.',
});

// Desktop shows the side panels by default; phones start with them collapsed
// (they overlay the canvas) and the user opens them from the header.
const isDesktop = useMediaQuery('(min-width: 768px)');

/* ---------- Engine assembly ----------
   The page is wiring: scene plumbing (useThree + renderer + backgrounds),
   the geometry engine (usePhaseGeometry), the camera (useAutoCamera)
   and the playback orchestrator (usePlaybackOrchestration), joined by the
   render loop
   . All engine behaviour lives in the composables. */

// User settings survive navigation (e.g. /about and back) via useState -
// see useScopeSettings for the full key inventory.
const settings = useScopeSettings();
const { renderMode, topologyMode, showGoniometer, advancedOptionsOpen } = settings;
const canvasContainer = ref<HTMLDivElement | null>(null);

const three = useThree(canvasContainer);
const scene = three.scene;
const renderer = useCorridorRenderer(scene);

const dreamBg = useDreamBackground(
    scene,
    computed(() => settings.background.value === 'dream')
);
const starfieldBg = useStarfieldBackground(
    scene,
    computed(() => settings.background.value === 'starfield')
);

// 3D Lissajous scope mode: the live phase portrait in a cube, no time axis.
const scope3d = ref(false);

const player = useWavPlayer();
const geometry = usePhaseGeometry({ renderer, renderMode, topologyMode, audio: player.audio });

const livePhase = ref<LivePhase>('off');
const liveMode = computed(
    () => livePhase.value === 'armed' || livePhase.value === 'playing' || livePhase.value === 'done'
);

const camera = useAutoCamera({
    three,
    renderer,
    geometry,
    topologyMode,
    wavLoaded: computed(() => player.wavLoaded.value || liveMode.value),
    lissajousActive: scope3d,
    lissajousDimension: usePersistedState<'3d' | '2d'>('scope:liss-dimension', () => '3d'),
});
const playback = usePlaybackOrchestration({ three, geometry, camera, topologyMode, player });

const {
    corridorState,
    corridorMeta,
    trackCoveragePercent,
    channelBias,
    effectiveMaxPoints,
    pointsWarningLevel,
    formatPointCount,
} = geometry;
const { cameraMode, setCameraMode, toggleCameraMode } = camera;
const { isFullscreen } = three;
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
    unloadTrack,
    handleSelectDemoTrack,
    handleLoadFile,
    playAdjacentTrack,
    initMediaSessionHandlers,
    dispose: disposePlayback,
} = playback;

// The live-input feature (MIDI input)
const live = useLiveSession({ livePhase, geometry, camera, topologyMode, player, stopPlayback: handleStop });

// Demo menu model + the "Pick a demo" doors (desktop: the transport's
// dropdown; phones: the overlay). Rows and groups come from the audio
// manifest - see useDemoMenu / the audio-manifest module.
const transportRef = ref<{ openDemoMenu: () => void } | null>(null);
const { demoTrackItems, showDemoOverlay, onPickDemo, onPickDemoTrack } = useDemoMenu({
    sortedDemoTracks,
    isDesktop,
    transportRef,
    selectTrack: handleSelectDemoTrack,
});

// DEV-ONLY playback tools: auto-play next track + folder playlists. The
// import.meta.dev guard is a build-time constant, so this whole branch (and
// the lazily-imported bar below) is statically absent from production.
const devPlaylist = import.meta.dev ? useDevPlaylist({ player, playback }) : null;

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

// Touch camera (mobile): pinch to zoom, one-finger drag to rotate, double-tap
// to hand back to the auto path. Touch-only - the desktop mouse/WASD fly camera
// is untouched. 2D scope keeps rotation locked but allows pinch-zoom.
const touchOrbit = useTouchOrbit({
    three,
    camera,
    topologyMode,
    scopeActive: scope3d,
    scope2dLocked,
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

// The visibility choreography (desktop defaults, phone never-stack rules,
// scope entry clearing) lives in usePanelLayout; the page only consumes it.
const { showControlsOverlay, showSettings, showScopeSettings, toggleControls, toggleSettings, toggleScopeSettings } =
    usePanelLayout({ isDesktop, showGoniometer, scope3d });

const uiActive = computed(() => wavLoaded.value || liveMode.value);

// The two floating side panels share their rise animation and top anchor;
// each side adds its own edge, stacking and size constraints in the template.
const SIDE_PANEL_CLASS = 'ps-rise absolute top-24 overflow-y-auto';

/* ---------- Goniometer HUD ---------- */

// Pull-based source: the component samples this inside its own ~30fps rAF
// loop (no reactive churn, no contact with the WebGL path).
const goniometerSource = () => {
    if (liveMode.value) return live.liveSource();
    const raw = toRaw(corridorState.value);
    if (!raw.ch0 || !raw.ch1 || !raw.buffer) return null;
    return { ch0: raw.ch0, ch1: raw.ch1, index: Math.floor(getPlaybackTimeSeconds() * raw.sr), sr: raw.sr };
};

const lissajous = useLissajous3D(three, goniometerSource);
watch(scope3d, (active) => {
    lissajous.active.value = active;
    renderer.setCorridorVisible(!active);
});

// The logo is the way home: live exits to wherever it came from;
// listening unloads back to the two doors; home is a no-op
const goHome = () => {
    if (livePhase.value !== 'off') live.exitLive();
    else if (wavLoaded.value) unloadTrack();
};

/* ---------- Background skyboxes ---------- */

// Shortcut presses toggle a background on, or off if it's already the one showing.
const toggleBackground = (id: Exclude<BackgroundId, 'none'>) => {
    settings.background.value = settings.background.value === id ? 'none' : id;
};

/* ---------- Keyboard shortcuts ---------- */

// The whole keymap lives in useScopeShortcuts - one table to read or extend.
useScopeShortcuts({
    renderMode,
    channelBias,
    oscillationEnabled: oscillation.enabled,
    showGoniometer,
    toggleFullscreen: three.toggleFullscreen,
    handlePlayPause,
    toggleControls,
    toggleCameraMode,
    toggleBackground,
    playAdjacentTrack,
});

/* ---------- Render loop ---------- */

// Build points progressively: paced by the playback clock for tracks, by
// the synth's sample clock for live input
const updateGeometryBuild = () => {
    if (liveMode.value) live.updateBuild();
    else geometry.updateProgressiveBuild(getPlaybackTimeSeconds());
};

// Drive the GPU oscillation (four uniform writes; the displacement happens
// in the vertex shader, off the CPU entirely)
const driveOscillation = (timeInSeconds: number) => {
    renderer.setOscillation({
        time: timeInSeconds,
        mode: oscillation.enabled.value ? oscillation.mode.value : 'off',
        builtFrames: liveMode.value ? geometry.headFrameIndex() + 1 : corridorState.value.builtFrames,
        pointsPerFrame: corridorMeta.value.pointsPerFrame,
    });
};

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
        updateGeometryBuild();
        // Touch orbit drives the camera while a gesture owns it (mobile);
        // otherwise the auto camera (orbit/follow) does.
        if (!touchOrbit.update()) camera.update(timeInSeconds);
        driveOscillation(timeInSeconds);
    }

    if (scope3d.value) lissajous.update();

    const r = three.renderer.value;
    const c = three.camera.value;
    dreamBg.update(now / 1000, c?.position);
    starfieldBg.update(now / 1000, c?.position);
    if (r && c) r.render(scene, c);
    requestAnimFrame = requestAnimationFrame(animate);
};

/* ---------- Lifecycle ---------- */

onMounted(() => {
    three.init();
    touchOrbit.init(); // wire touch listeners now the renderer DOM + controls exist
    initMediaSessionHandlers();
    requestAnimFrame = requestAnimationFrame(animate);

    // Dev-only escape hatch for inspecting the live engine from the console
    if (import.meta.dev) {
        (window as unknown as Record<string, unknown>).__scope = {
            three,
            renderer,
            geometry,
            oscillation,
            live,
            livePhase,
            camera,
            touchOrbit,
            devPlaylist,
        };
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
    starfieldBg.dispose();
    three.dispose();
});
</script>

<template>
    <div class="fixed inset-0 overflow-hidden bg-(--bg) text-(--text)">
        <!-- Live canvas fills the viewport; slow-zooms while playing -->
        <div
            ref="canvasContainer"
            class="absolute inset-0 touch-none bg-black motion-safe:transition-transform motion-safe:duration-[6000ms] motion-safe:ease-(--motion-ease-standard)"
            :class="{ 'motion-safe:scale-[1.04]': !!audio.source }"
        />

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
        />
        <div class="ps-striation pointer-events-none absolute inset-0 z-0 opacity-50 mix-blend-overlay" />

        <!-- Source picker: two doors into the same hall. Listen loads a
             track; Play opens the live session card. -->
        <LayoutSourcePicker
            v-if="!wavLoaded && livePhase === 'off'"
            class="absolute inset-0 z-10"
            @load-file="handleLoadFile"
            @pick-demo="onPickDemo"
            @go-live="live.toggleLive"
        />

        <!-- Mobile demo picker: the transport's dropdown is hidden during phone
             onboarding, so "Pick a demo" opens this overlay instead (desktop
             keeps the bottom-bar dropdown). -->
        <LayoutDemoPickerOverlay
            v-if="showDemoOverlay"
            :items="demoTrackItems"
            @pick="onPickDemoTrack"
            @close="showDemoOverlay = false"
        />

        <!-- Top: floating header -->
        <LayoutAppHeader
            class="absolute inset-x-5 top-5 z-30"
            :controls-open="showControlsOverlay"
            :settings-open="showSettings"
            :goniometer-open="showGoniometer"
            @toggle-controls="toggleControls"
            @toggle-settings="toggleSettings"
            @toggle-goniometer="showGoniometer = !showGoniometer"
            @toggle-fullscreen="three.toggleFullscreen"
            @exit="goHome"
        />

        <div
            v-if="scope3d"
            class="ps-rise ps-glass absolute right-5 top-24 z-30 flex items-center gap-1 p-1 [clip-path:var(--clip-chamfer-sm)] md:hidden"
        >
            <DsButton
                variant="ghost"
                size="md"
                class="text-(--brand-white)"
                label="Exit 3D Scope"
                @click="scope3d = false"
            />
            <DsIconButton
                icon="i-lucide-settings"
                variant="ghost"
                size="md"
                aria-label="Scope settings"
                @click="toggleScopeSettings"
            />
        </div>

        <DsGlassModal
            v-if="!isDesktop && scope3d && showScopeSettings"
            title="Scope Settings"
            @close="showScopeSettings = false"
        >
            <div class="overflow-y-auto p-4">
                <LayoutScopeSettingsControls
                    v-model:dimension="lissajous.dimension.value"
                    v-model:waveform="lissajous.showWaveform.value"
                    v-model:line-width="lissajous.lineWidth.value"
                    v-model:colour-mode="lissajous.colourMode.value"
                    v-model:custom-colour="lissajous.customColour.value"
                />
            </div>
        </DsGlassModal>

        <!-- Left: display settings (advanced options disclosed in-panel) -->
        <!-- z-40 on phones puts the settings panel above the bottom bar (z-30);
             desktop keeps z-20 (they don't overlap there). -->
        <div
            v-if="showSettings && uiActive && !isFullscreen"
            :class="[
                SIDE_PANEL_CLASS,
                'left-5 z-40 max-h-[calc(100svh_-_14rem)] w-[min(100vw_-_2.5rem,37.5rem)] md:z-20',
            ]"
        >
            <LayoutDisplayPanel
                v-model:live-voice="live.voice.value"
                v-model:points-per-frame="corridorMeta.pointsPerFrame"
                v-model:coverage="trackCoveragePercent"
                v-model:render-mode="renderMode"
                v-model:topology="topologyMode"
                v-model:oscillation="oscillation.enabled.value"
                v-model:background="settings.background.value"
                variant="glass"
                :live="liveMode"
                :wav-loaded="wavLoaded"
                :settings-disabled="false"
                :topology-disabled="audio.started"
                :perf-level="pointsWarningLevel"
                :perf-points="formatPointCount(effectiveMaxPoints)"
                @close="showSettings = false"
            >
                <template #advanced>
                    <LayoutAdvancedPanel v-model:open="advancedOptionsOpen" v-model:mode="oscillation.mode.value" />
                </template>
            </LayoutDisplayPanel>
        </div>

        <div
            v-if="showControlsOverlay && uiActive && isDesktop"
            :class="[SIDE_PANEL_CLASS, 'right-5 z-20 max-h-[calc(100svh_-_12rem)]']"
        >
            <LayoutControlsOverlay
                :camera-mode="cameraMode"
                :speed-index="movement.speedIndex.value"
                :moving="movement.isMoving.value"
                :disabled="!wavLoaded && !liveMode"
                @set-camera-mode="setCameraMode"
                @set-speed="setMovementSpeed"
                @close="showControlsOverlay = false"
            />
        </div>

        <!-- Bottom-left: goniometer HUD (the instantaneous phase portrait)
             plus, while the 3D scope is active, its settings rising above. -->
        <!-- On short windows the panel sits beside the goniometer instead of
             above it, so the stack never reaches the header/logo -->
        <!-- On phones the scopes stack vertically above the (tall, wrapping)
             bottom bar, scaled down to fit between it and the header; desktop
             keeps full size, bottom-5 and the short-height row layout. -->
        <div
            v-if="showGoniometer && (wavLoaded || liveMode)"
            class="absolute bottom-64 left-5 z-20 flex origin-bottom-left flex-col items-start gap-3 md:bottom-5 md:[@media(max-height:880px)]:flex-row md:[@media(max-height:880px)]:items-end"
            :class="scope3d ? 'max-md:scale-[0.72]' : 'max-md:scale-[0.8]'"
        >
            <LayoutScopeSettingsPanel
                v-if="scope3d && isDesktop"
                v-model:dimension="lissajous.dimension.value"
                v-model:waveform="lissajous.showWaveform.value"
                v-model:line-width="lissajous.lineWidth.value"
                v-model:colour-mode="lissajous.colourMode.value"
                v-model:custom-colour="lissajous.customColour.value"
                class="ps-rise max-h-[calc(100svh_-_8rem)] overflow-y-auto"
            />
            <!-- The two scopes stand together: phase (the relationship)
                 and waveform (the forms) of the same signal. In the 3D scope on
                 phones they hide - the cube IS the figure, and the settings
                 panel needs the room. -->
            <div class="flex flex-col items-start gap-3 md:flex-row md:items-end" :class="{ 'max-md:hidden': scope3d }">
                <LayoutGoniometer
                    class="ps-rise"
                    :source="goniometerSource"
                    :active3d="scope3d"
                    @toggle3d="scope3d = !scope3d"
                />
                <LayoutWaveform class="ps-rise hidden max-md:flex min-[1400px]:flex" :source="goniometerSource" />
            </div>
        </div>

        <!-- DEV-ONLY tools chip (never rendered - or even fetched - in prod) -->
        <LazyLayoutDevPlaylistBar
            v-if="devPlaylist && livePhase === 'off'"
            v-model:auto-advance="devPlaylist.autoAdvance.value"
            class="absolute bottom-5 right-5 z-20 max-md:hidden"
            :track-count="devPlaylist.trackCount.value"
            @open-folder="devPlaylist.openFolder"
        />

        <!-- Act 1: the session card (the stage door) -->
        <LayoutLiveSessionCard
            v-if="livePhase === 'setup'"
            v-model:topology="topologyMode"
            v-model:duration="live.liveDuration.value"
            v-model:voice="live.voice.value"
            class="ps-rise absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2"
            :device-names="live.deviceNames.value"
            @start="live.startSession"
            @cancel="live.exitLive"
        />

        <!-- Bottom dock: one slot, two costumes - the transport while
             listening, the live stage from armed onward -->
        <main id="content" tabindex="-1" class="focus-visible:outline-none">
            <LayoutLiveKeys
                v-if="liveMode"
                class="ps-rise absolute inset-x-4 bottom-5 z-30 mx-auto w-full max-w-2xl"
                :phase="livePhase === 'armed' ? 'armed' : livePhase === 'playing' ? 'playing' : 'done'"
                :device-names="live.deviceNames.value"
                :last-event="live.lastEvent.value"
                :voice-count="live.activeVoiceCount.value"
                :primary-line="live.livePrimaryLine.value"
                :secondary-line="live.liveSecondaryLine.value"
                :progress="live.liveProgress.value"
                :progress-label="live.liveProgressLabel.value"
                :lit-notes="live.ghostLit.value"
                :ghost-active="live.ghostActive.value"
                @note-on="(n: number) => live.playVirtualNote(n, true)"
                @note-off="(n: number) => live.playVirtualNote(n, false)"
                @new-session="live.startSession"
                @change-canvas="livePhase = 'setup'"
                @demo="live.playGhost"
                @exit="live.exitLive"
            />
            <LayoutTransportBar
                v-if="livePhase === 'off' && (isDesktop || wavLoaded)"
                ref="transportRef"
                class="absolute inset-x-4 bottom-5 z-30 mx-auto w-fit max-w-[calc(100vw_-_2rem)]"
                :live="liveMode"
                :playing="!!audio.source"
                :audio-loaded="wavLoaded"
                :started="audio.started"
                :elapsed="elapsedLabel"
                :tracks="demoTrackItems"
                :tracks-loading="demoTracksLoading"
                :selected-track="selectedDemoTrackId ?? undefined"
                @play-pause="handlePlayPause"
                @stop="handleStop"
                @load-file="handleLoadFile"
                @select-track="handleSelectDemoTrack"
                @toggle-live="live.toggleLive"
            />
        </main>
    </div>
</template>
