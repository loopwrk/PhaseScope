<script setup lang="ts">
import { toRaw } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import type { LivePhase } from '~/composables/useLiveSession.client';

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

const dreamBg = useDreamBackground(
    scene,
    computed(() => settings.background.value === 'dream')
);
const starfieldBg = useStarfieldBackground(
    scene,
    computed(() => settings.background.value === 'starfield')
);

// 3D Lissajous scope mode: the live phase portrait in a cube, no time axis.
// Entered by clicking the goniometer; the corridor hides while it is active.
const scope3d = ref(false);

const player = useWavPlayer();
const geometry = usePhaseGeometry({ renderer, renderMode, topologyMode, audio: player.audio });
/* The live session phase lives at the composition root because the camera's
   wavLoaded gate (below) reads liveMode before useLiveSession is built. The
   logic that acts on the phase lives in useLiveSession; 'setup' is the stage
   door, a session is on stage from 'armed' onward, and liveMode gates
   geometry/camera/panels. */
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

// Flat bindings for the template
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

// The live-input feature (MIDI keyboard + on-screen keys): the three-act
// session machine, the ghost demo, the dock's narration, and the synth + MIDI
// it owns. The phase ref is shared (the camera gates on liveMode); everything
// that drives it lives in the composable.
const live = useLiveSession({ livePhase, geometry, camera, topologyMode, player, stopPlayback: handleStop });

type DemoMenuItem =
    | { type: 'label'; label: string }
    | { type: 'separator'; class?: string }
    | { label: string; value: string };
const SEP_WHITE = 'bg-(--brand-white)';
const SEP_RED = 'bg-[var(--brand-primary)]';
// Groups and their order come entirely from the audio subfolders (see the
// audio-manifest module): sortedDemoTracks is already in menu order, so a
// new group heading opens each time the group changes.
const demoTrackItems = computed(() => {
    const items: DemoMenuItem[] = [];
    let currentGroup: string | null = null;
    for (const t of sortedDemoTracks.value) {
        if (t.group !== currentGroup) {
            if (currentGroup !== null) items.push({ type: 'separator', class: SEP_WHITE });
            items.push({ type: 'label', label: t.group }); // heading (uppercased via CSS)
            items.push({ type: 'separator', class: SEP_RED });
            currentGroup = t.group;
        }
        items.push({ label: t.name, value: t.id });
    }
    return items;
});

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

const showControlsOverlay = ref(true);
const showSettings = ref(true);
// Phones only: in the 3D scope the controls button opens the scope settings on
// demand (so they don't sit over the cube) rather than the camera/movement
// panel. Desktop shows the scope settings inline and never uses this.
const showScopeSettings = ref(false);

// First-load quiet: neither side panel exists until there is something
// to control - a loaded track or a live session. The transport bar is
// the whole interface until then.
const uiActive = computed(() => wavLoaded.value || liveMode.value);

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

// The goniometer + waveform are large, so default them off on phones; desktop
// keeps its own default (true) and isn't reset on resize.
watch(
    isDesktop,
    (desktop) => {
        if (!desktop) showGoniometer.value = false;
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

// The scope-settings gear (phones, in the 3D scope) toggles its panel; closing
// the display settings keeps the two from stacking.
const toggleScopeSettings = () => {
    showScopeSettings.value = !showScopeSettings.value;
    if (showScopeSettings.value) showSettings.value = false;
};

/* ---------- Goniometer HUD ---------- */

// Pull-based source: the component samples this inside its own ~30fps rAF
// loop (no reactive churn, no contact with the WebGL path). Shows the
// window at the playhead whether playing or paused - a scope reads
// whatever is at the probe.
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
    // Enter with the cube clear; on phones the controls button reveals the panel
    if (active) showScopeSettings.value = false;
});

// The idle fork's Listen door: a page-level file picker + a hand into
// the transport's demo menu
const forkFileInput = ref<HTMLInputElement | null>(null);
const transportRef = ref<{ openDemoMenu: () => void } | null>(null);
const onForkFile = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleLoadFile(file);
    input.value = '';
};

// "Pick a demo": on desktop, reach into the transport's dropdown; on phones the
// transport is hidden during onboarding, so open a dedicated overlay instead.
const showDemoOverlay = ref(false);
const onPickDemo = () => {
    if (isDesktop.value) transportRef.value?.openDemoMenu();
    else showDemoOverlay.value = true;
};
const onPickDemoTrack = (id: string) => {
    handleSelectDemoTrack(id);
    showDemoOverlay.value = false;
};

// The logo is the way home: live exits to wherever it came from;
// listening unloads back to the two doors; home is a no-op
const goHome = () => {
    if (livePhase.value !== 'off') live.exitLive();
    else if (wavLoaded.value) unloadTrack();
};

/* ---------- Background skyboxes ---------- */

// Shortcut presses toggle a background on, or off if it's already the one showing.
const toggleBackground = (id: 'dream') => {
    settings.background.value = settings.background.value === id ? 'none' : id;
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
shortcuts.register('b', () => toggleBackground('dream'));
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
        // Build points progressively: paced by the playback clock for
        // tracks, by the synth's sample clock for live input
        if (liveMode.value) {
            live.updateBuild();
        } else {
            geometry.updateProgressiveBuild(getPlaybackTimeSeconds());
        }
        // Update camera: touch orbit drives while a gesture owns it (mobile),
        // otherwise the auto camera (orbit/follow) does.
        if (!touchOrbit.update()) camera.update(timeInSeconds);
        // Drive the GPU oscillation (four uniform writes; the displacement
        // happens in the vertex shader, off the CPU entirely)
        renderer.setOscillation({
            time: timeInSeconds,
            mode: oscillation.enabled.value ? oscillation.mode.value : 'off',
            builtFrames: liveMode.value ? geometry.headFrameIndex() + 1 : corridorState.value.builtFrames,
            pointsPerFrame: corridorMeta.value.pointsPerFrame,
        });
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
        <!-- Live canvas fills the viewport; slow-zooms while playing (plan 2.8,
             a transform on the container only - the engine is untouched) -->
        <div
            ref="canvasContainer"
            class="absolute inset-0 touch-none bg-black motion-safe:transition-transform motion-safe:duration-[6000ms] motion-safe:ease-(--motion-ease-standard)"
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

        <!-- Idle fork: two doors into the same hall. Listen loads a track;
             Play opens the live session card. -->
        <div
            v-if="!wavLoaded && livePhase === 'off'"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-7"
        >
            <DsLogo :size="56" mono class="text-(--text-muted)" />
            <p class="ps-label">No signal</p>
            <div class="flex flex-col gap-4 sm:flex-row">
                <div
                    class="ps-glass flex w-60 flex-col items-center gap-2 border border-(--border-strong) px-6 py-5 [clip-path:var(--clip-notch)]"
                >
                    <UIcon name="i-lucide-headphones" class="size-7 text-(--accent)" />
                    <span class="font-display text-body font-semibold">Listen</span>
                    <div class="mx-auto mt-1 flex w-fit flex-col items-stretch gap-2">
                        <DsButton
                            variant="secondary"
                            class="mr-0 py-2 ring-(--brand-primary) text-(--brand-white)"
                            size="md"
                            icon="i-lucide-upload"
                            label="Load audio"
                            @click="forkFileInput?.click()"
                        />
                        <DsButton
                            variant="secondary"
                            class="mr-0 py-2 ring-(--brand-primary) text-(--brand-white)"
                            size="md"
                            icon="i-lucide-disc-3"
                            label="Pick a demo"
                            @click="onPickDemo"
                        />
                    </div>
                </div>
                <div
                    class="ps-glass flex w-60 flex-col items-center gap-2 border border-(--border-strong) px-6 py-5 [clip-path:var(--clip-notch)]"
                >
                    <UIcon name="i-lucide-keyboard-music" class="size-7 text-(--accent)" />
                    <span class="font-display text-body font-semibold">Play</span>
                    <span class="text-caption text-center text-(--text-muted)"
                        >Play with a MIDI keyboard or on-screen keys</span
                    >
                    <div class="mx-auto mt-1 flex w-fit flex-col items-stretch">
                        <DsButton
                            variant="secondary"
                            class="mr-0 py-2 ring-(--brand-primary) text-(--brand-white)"
                            size="md"
                            icon="i-lucide-keyboard-music"
                            label="Go live"
                            @click="live.toggleLive"
                        />
                    </div>
                </div>
            </div>
            <input ref="forkFileInput" type="file" accept="audio/*" class="hidden" @change="onForkFile" />
        </div>

        <!-- Mobile demo picker: the transport's dropdown is hidden during phone
             onboarding, so "Pick a demo" opens this overlay instead (desktop
             keeps the bottom-bar dropdown). -->
        <div
            v-if="showDemoOverlay"
            class="absolute inset-0 z-40 flex items-center justify-center bg-[color-mix(in_oklch,var(--bg)_80%,transparent)] px-6"
            @click.self="showDemoOverlay = false"
        >
            <div
                class="ps-glass flex max-h-[70svh] w-full max-w-sm flex-col border border-(--border-strong) [clip-path:var(--clip-notch)]"
            >
                <div class="flex items-center justify-between gap-2 border-b border-(--border-strong) px-4 py-3">
                    <span class="font-display text-body font-semibold">Pick a demo</span>
                    <button
                        type="button"
                        class="text-(--text-muted) hover:text-(--text) focus-visible:outline-none focus-visible:shadow-(--focus-glow)"
                        aria-label="Close"
                        @click="showDemoOverlay = false"
                    >
                        <UIcon name="i-lucide-x" class="size-5" />
                    </button>
                </div>
                <ul class="flex flex-col gap-0.5 overflow-y-auto p-2">
                    <template v-for="(item, i) in demoTrackItems" :key="i">
                        <li
                            v-if="item.type === 'label'"
                            class="px-3 pb-1 pt-3 font-mono text-caption uppercase tracking-label text-(--brand-white)"
                        >
                            {{ item.label }}
                        </li>
                        <li
                            v-else-if="item.type === 'separator'"
                            :class="['mx-2 my-1 h-px', item.class]"
                            aria-hidden="true"
                        />
                        <li v-else>
                            <button
                                type="button"
                                class="w-full px-3 py-2 text-left text-detail text-(--text) hover:bg-(--surface-sunken) focus-visible:outline-none focus-visible:shadow-(--focus-glow)"
                                @click="onPickDemoTrack((item as { value: string }).value)"
                            >
                                {{ item.label }}
                            </button>
                        </li>
                    </template>
                </ul>
            </div>
        </div>

        <!-- Top: floating header -->
        <LayoutAppHeader
            class="absolute inset-x-5 top-5 z-30"
            :controls-open="showControlsOverlay"
            :settings-open="showSettings"
            :goniometer-open="showGoniometer"
            :scope-active="scope3d"
            :scope-settings-open="showScopeSettings"
            @toggle-controls="toggleControls"
            @toggle-settings="toggleSettings"
            @toggle-goniometer="showGoniometer = !showGoniometer"
            @toggle-scope-settings="toggleScopeSettings"
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

        <div
            v-if="!isDesktop && scope3d && showScopeSettings"
            class="absolute inset-0 z-40 flex items-center justify-center bg-[color-mix(in_oklch,var(--bg)_80%,transparent)] px-6"
            @click.self="showScopeSettings = false"
        >
            <div
                class="ps-glass flex max-h-[70svh] w-full max-w-sm flex-col border border-(--border-strong) [clip-path:var(--clip-notch)]"
            >
                <div class="flex items-center justify-between gap-2 border-b border-(--border-strong) px-4 py-3">
                    <span class="font-display text-body font-semibold">Scope Settings</span>
                    <button
                        type="button"
                        class="text-(--text-muted) hover:text-(--text) focus-visible:outline-none focus-visible:shadow-(--focus-glow)"
                        aria-label="Close"
                        @click="showScopeSettings = false"
                    >
                        <UIcon name="i-lucide-x" class="size-5" />
                    </button>
                </div>
                <div class="overflow-y-auto p-4">
                    <LayoutScopeSettingsControls
                        v-model:dimension="lissajous.dimension.value"
                        v-model:waveform="lissajous.showWaveform.value"
                        v-model:line-width="lissajous.lineWidth.value"
                        v-model:colour-mode="lissajous.colourMode.value"
                        v-model:custom-colour="lissajous.customColour.value"
                    />
                </div>
            </div>
        </div>

        <!-- Left: display settings (advanced options disclosed in-panel) -->
        <!-- z-40 on phones puts the settings panel above the bottom bar (z-30);
             desktop keeps z-20 (they don't overlap there). -->
        <div
            v-if="showSettings && uiActive && !isFullscreen"
            class="ps-rise absolute left-5 top-24 z-40 max-h-[calc(100svh_-_14rem)] w-[min(100vw_-_2.5rem,37.5rem)] overflow-y-auto md:z-20"
        >
            <LayoutDisplayPanel
                variant="glass"
                v-model:live-voice="live.voice.value"
                @close="showSettings = false"
                v-model:pointsPerFrame="corridorMeta.pointsPerFrame"
                v-model:coverage="trackCoveragePercent"
                v-model:renderMode="renderMode"
                v-model:topology="topologyMode"
                v-model:oscillation="oscillation.enabled.value"
                v-model:background="settings.background.value"
                :live="liveMode"
                :wav-loaded="wavLoaded"
                :settings-disabled="false"
                :topology-disabled="audio.started"
                :perf-level="pointsWarningLevel"
                :perf-points="formatPointCount(effectiveMaxPoints)"
            >
                <template #advanced>
                    <LayoutAdvancedPanel v-model:open="advancedOptionsOpen" v-model:mode="oscillation.mode.value" />
                </template>
            </LayoutDisplayPanel>
        </div>

        <!-- Right: live controls HUD -->
        <!-- Positioning wrapper: Panel's scoped position:relative beats the
             absolute utility on its own root, so the offsets live out here
             (same pattern as the Display Settings panel) -->
        <!-- Camera + movement controls: desktop-only (its toggle is hidden on
             phones, where camera/movement aren't useful). -->
        <div
            v-if="showControlsOverlay && uiActive && isDesktop"
            class="ps-rise absolute right-5 top-24 z-20 max-h-[calc(100svh_-_12rem)] overflow-y-auto"
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
                class="ps-rise max-h-[calc(100svh_-_8rem)] overflow-y-auto"
                v-model:dimension="lissajous.dimension.value"
                v-model:waveform="lissajous.showWaveform.value"
                v-model:line-width="lissajous.lineWidth.value"
                v-model:colour-mode="lissajous.colourMode.value"
                v-model:custom-colour="lissajous.customColour.value"
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
