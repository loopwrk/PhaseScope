<script setup lang="ts">
import { midiNoteName } from '~/utils/midi';
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
/* Live session phase: 'setup' is the stage door (the card); a session
   is on stage from 'armed' onward. liveMode gates geometry/camera/panels. */
type LivePhase = 'off' | 'setup' | 'armed' | 'playing' | 'done';
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
    useAlternateColors,
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

const DEMO_GROUP_ORDER = ['Stable/Harmonic', 'Experimental', 'Genres'];
type DemoMenuItem =
    | { type: 'label'; label: string }
    | { type: 'separator'; class?: string }
    | { label: string; value: string };
const SEP_WHITE = 'bg-(--brand-white)';
const SEP_RED = 'bg-[var(--brand-primary)]';
const demoTrackItems = computed(() => {
    const items: DemoMenuItem[] = [];
    let first = true;
    for (const group of DEMO_GROUP_ORDER) {
        const inGroup = sortedDemoTracks.value.filter((t) => t.group === group);
        if (!inGroup.length) continue;
        if (!first) items.push({ type: 'separator', class: SEP_WHITE });
        items.push({ type: 'label', label: group }); // heading (uppercased via CSS)
        items.push({ type: 'separator', class: SEP_RED });
        for (const t of inGroup) items.push({ label: t.name, value: t.id });
        first = false;
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
    if (liveMode.value) return synth.liveSource();
    const raw = toRaw(corridorState.value);
    if (!raw.ch0 || !raw.ch1 || !raw.buffer) return null;
    return { ch0: raw.ch0, ch1: raw.ch1, index: Math.floor(getPlaybackTimeSeconds() * raw.sr), sr: raw.sr };
};

const lissajous = useLissajous3D(three, goniometerSource);
watch(scope3d, (active) => {
    lissajous.active.value = active;
    renderer.setCorridorVisible(!active);
});

/* ---------- Live session (MIDI keyboard + on-screen keys) ----------
   Three acts: SETUP (the card - choose canvas and length), ARMED (empty
   stage, clock waiting for the first note), PLAYING (countdown rail),
   DONE (hard stop -> new session / change canvas). */

const midi = useMidiInput();
const synth = useLiveSynth();

/** Sphere/Möbius session length in seconds (corridor is open-ended) */
const liveDuration = usePersistedState('scope:live-duration', () => 60);

// Every note path runs through here: the first note-on arms the live
// clock and raises the curtain on the PLAYING act
const liveNote = (note: number, velocity: number, on: boolean) => {
    if (on) {
        geometry.armLiveClock(synth.samplesWritten());
        if (livePhase.value === 'armed') livePhase.value = 'playing';
        synth.noteOn(note, velocity);
    } else {
        synth.noteOff(note);
    }
};

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

// On-screen keys speak through the same monitor readout as hardware
const playVirtualNote = (note: number, on: boolean) => {
    liveNote(note, 100, on);
    midi.lastEvent.value = { on, note, velocity: 100, device: 'on-screen', label: midiNoteName(note) };
};

// Act 1: the stage door. Synth + MIDI wake here so the card can name the
// connected device; geometry waits for "Take the stage".
const enterLiveSetup = async () => {
    handleStop(); // the stage belongs to one signal at a time
    if (topologyMode.value === 'attractor') topologyMode.value = 'corridor'; // card offers it greyed
    if (!(await synth.enable({ ringQuantum: corridorMeta.value.hopSize }))) return;
    await midi.connect(); // no device is fine - the on-screen keys play the same synth
    midi.onNote((e) => liveNote(e.note, e.velocity, e.on));
    livePhase.value = 'setup';
};

// Act 2: take the stage - blank ring, fresh canvas, clock waiting
const startSession = () => {
    stopGhost();
    synth.resetRing();
    const ring = synth.ringInfo();
    if (!ring) return;
    geometry.initLive(ring, { durationSeconds: liveDuration.value });
    camera.resetOrbitClock();
    livePhase.value = 'armed';
};

const exitLive = () => {
    stopGhost();
    synth.disable();
    midi.disconnect();
    livePhase.value = 'off';
    // Hand the stage back: a loaded track redraws on play; otherwise idle
    if (audio.buffer) geometry.initFromBuffer(audio.buffer);
    else geometry.clear();
};

const toggleLive = () => {
    if (livePhase.value === 'off') void enterLiveSetup();
    else exitLive();
};

// The logo is the way home: live exits to wherever it came from;
// listening unloads back to the two doors; home is a no-op
const goHome = () => {
    if (livePhase.value !== 'off') exitLive();
    else if (wavLoaded.value) unloadTrack();
};

/* ---- Session narration + countdown (the dock's voice) ---- */

const LIVE_CANVAS_NAMES: Record<string, string> = {
    corridor: 'column',
    sphere: 'sphere',
    attractor: 'attractor',
    mobius: 'Möbius band',
};
const liveCanvasName = computed(() => LIVE_CANVAS_NAMES[topologyMode.value] ?? topologyMode.value);

const fmtSessionTime = (seconds: number) => {
    const t = Math.max(0, Math.round(seconds));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const liveProgress = computed(() => {
    const { live, frameCount, builtFrames } = corridorState.value;
    if (!live || !frameCount) return 0;
    return Math.min(1, builtFrames / frameCount);
});
const liveProgressLabel = computed(() => {
    const { frameCount, builtFrames, sr } = corridorState.value;
    const secondsLeft = ((frameCount - builtFrames) * corridorMeta.value.hopSize) / (sr || 48000);
    return `${fmtSessionTime(secondsLeft)} left`;
});
const livePrimaryLine = computed(() => {
    if (livePhase.value === 'armed') return 'Play your first note - the clock starts with it';
    if (livePhase.value === 'done') {
        return topologyMode.value === 'corridor'
            ? 'Column complete - walk through it, or go again'
            : `Canvas complete - walk around your ${liveCanvasName.value}, or go again`;
    }
    return '';
});
const liveSecondaryLine = computed(
    () => `${fmtSessionTime(liveDuration.value)} on the ${liveCanvasName.value} · waiting`
);

/* ---- The ghost performance ("show me"): the app demonstrates itself
   in its own medium - six seconds of scripted melody through the real
   synth, keys lighting as it plays, then a fresh armed stage. ---- */

const ghostActive = ref(false);
const ghostLit = ref<number[]>([]);
let ghostTimers: ReturnType<typeof setTimeout>[] = [];

const stopGhost = () => {
    ghostTimers.forEach(clearTimeout);
    ghostTimers = [];
    ghostLit.value = [];
    if (ghostActive.value) synth.allNotesOff();
    ghostActive.value = false;
};

// Long pads under a rising melody that crosses the stereo field, so the
// canvas knots, the colours move and the goniometer opens up
const GHOST_SCORE: { t: number; note: number; dur: number; vel: number }[] = [
    { t: 0, note: 48, dur: 2400, vel: 88 },
    { t: 350, note: 55, dur: 2100, vel: 80 },
    { t: 700, note: 64, dur: 1000, vel: 96 },
    { t: 1150, note: 67, dur: 1000, vel: 92 },
    { t: 1600, note: 72, dur: 1500, vel: 100 },
    { t: 2300, note: 71, dur: 800, vel: 84 },
    { t: 2750, note: 67, dur: 800, vel: 80 },
    { t: 3200, note: 60, dur: 1800, vel: 92 },
    { t: 3300, note: 52, dur: 1700, vel: 76 },
    { t: 4200, note: 76, dur: 1200, vel: 96 },
    { t: 4650, note: 72, dur: 1500, vel: 88 },
];

const playGhost = () => {
    if (ghostActive.value || livePhase.value !== 'armed') return;
    ghostActive.value = true;
    const ghostNote = (note: number, vel: number, on: boolean) => {
        liveNote(note, vel, on);
        midi.lastEvent.value = { on, note, velocity: vel, device: 'ghost', label: midiNoteName(note) };
        ghostLit.value = on ? [...ghostLit.value, note] : ghostLit.value.filter((n) => n !== note);
    };
    for (const ev of GHOST_SCORE) {
        ghostTimers.push(setTimeout(() => ghostNote(ev.note, ev.vel, true), ev.t));
        ghostTimers.push(setTimeout(() => ghostNote(ev.note, ev.vel, false), ev.t + ev.dur));
    }
    // Curtain call: hand back a fresh, armed stage
    ghostTimers.push(
        setTimeout(() => {
            stopGhost();
            startSession();
        }, 6800)
    );
};

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
        // Build points progressively: paced by the playback clock for
        // tracks, by the synth's sample clock for live input
        if (liveMode.value) {
            geometry.updateLiveBuild(synth.samplesWritten());
            // The hard stop becomes an invitation: flip to the DONE act
            const st = corridorState.value;
            if (livePhase.value === 'playing' && st.frameCount > 0 && st.builtFrames >= st.frameCount) {
                livePhase.value = 'done';
            }
        } else {
            geometry.updateProgressiveBuild(getPlaybackTimeSeconds());
        }
        // Update camera based on current mode
        camera.update(timeInSeconds);
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
    stopGhost();
    midi.disconnect();
    await synth.dispose();
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
                            @click="transportRef?.openDemoMenu()"
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
                            @click="toggleLive"
                        />
                    </div>
                </div>
            </div>
            <input ref="forkFileInput" type="file" accept="audio/*" class="hidden" @change="onForkFile" />
        </div>

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

        <!-- Left: display settings (advanced options disclosed in-panel) -->
        <div
            v-if="showSettings && uiActive && !isFullscreen"
            class="ps-rise absolute left-5 top-24 z-20 max-h-[calc(100svh_-_14rem)] w-[min(100vw_-_2.5rem,37.5rem)] overflow-y-auto"
        >
            <LayoutDisplayPanel
                variant="glass"
                v-model:live-voice="synth.voice.value"
                @close="showSettings = false"
                v-model:pointsPerFrame="corridorMeta.pointsPerFrame"
                v-model:coverage="trackCoveragePercent"
                v-model:renderMode="renderMode"
                v-model:topology="topologyMode"
                v-model:oscillation="oscillation.enabled.value"
                v-model:reverse="useAlternateColors"
                v-model:channel-bias="channelBias"
                :dream="dreamBg.enabled.value"
                :heavenly="heavenlyBg.enabled.value"
                :live="liveMode"
                :wav-loaded="wavLoaded"
                :settings-disabled="false"
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
        <!-- Positioning wrapper: Panel's scoped position:relative beats the
             absolute utility on its own root, so the offsets live out here
             (same pattern as the Display Settings panel) -->
        <div
            v-if="showControlsOverlay && uiActive"
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
        <div
            v-if="showGoniometer && (wavLoaded || liveMode)"
            class="absolute bottom-5 left-5 z-20 hidden flex-col items-start gap-3 md:flex [@media(max-height:880px)]:flex-row [@media(max-height:880px)]:items-end"
        >
            <LayoutScopeSettingsPanel
                v-if="scope3d"
                class="ps-rise max-h-[calc(100svh_-_8rem)] overflow-y-auto"
                v-model:dimension="lissajous.dimension.value"
                v-model:waveform="lissajous.showWaveform.value"
                v-model:line-width="lissajous.lineWidth.value"
                v-model:colour-mode="lissajous.colourMode.value"
                v-model:custom-colour="lissajous.customColour.value"
            />
            <!-- The two scopes stand together: phase (the relationship)
                 and waveform (the forms) of the same signal -->
            <div class="flex items-end gap-3">
                <LayoutGoniometer
                    class="ps-rise"
                    :source="goniometerSource"
                    :active3d="scope3d"
                    @toggle3d="scope3d = !scope3d"
                />
                <LayoutWaveform class="ps-rise hidden min-[1400px]:flex" :source="goniometerSource" />
            </div>
        </div>

        <!-- Act 1: the session card (the stage door) -->
        <LayoutLiveSessionCard
            v-if="livePhase === 'setup'"
            v-model:topology="topologyMode"
            v-model:duration="liveDuration"
            v-model:voice="synth.voice.value"
            class="ps-rise absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2"
            :device-names="midi.deviceNames.value"
            @start="startSession"
            @cancel="exitLive"
        />

        <!-- Bottom dock: one slot, two costumes - the transport while
             listening, the live stage from armed onward -->
        <main id="content" tabindex="-1" class="focus-visible:outline-none">
            <LayoutLiveKeys
                v-if="liveMode && !isFullscreen"
                class="ps-rise absolute inset-x-4 bottom-5 z-30 mx-auto w-full max-w-2xl"
                :phase="livePhase === 'armed' ? 'armed' : livePhase === 'playing' ? 'playing' : 'done'"
                :device-names="midi.deviceNames.value"
                :last-event="midi.lastEvent.value"
                :voice-count="synth.activeVoiceCount.value"
                :primary-line="livePrimaryLine"
                :secondary-line="liveSecondaryLine"
                :progress="liveProgress"
                :progress-label="liveProgressLabel"
                :lit-notes="ghostLit"
                :ghost-active="ghostActive"
                @note-on="(n: number) => playVirtualNote(n, true)"
                @note-off="(n: number) => playVirtualNote(n, false)"
                @new-session="startSession"
                @change-canvas="livePhase = 'setup'"
                @demo="playGhost"
                @exit="exitLive"
            />
            <LayoutTransportBar
                v-if="livePhase === 'off' && !isFullscreen"
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
                @toggle-live="toggleLive"
            />
        </main>
    </div>
</template>
