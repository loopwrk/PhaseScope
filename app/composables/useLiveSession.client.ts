import { midiNoteName } from '~/utils/midi';
import type { Ref } from 'vue';
import type { usePhaseGeometry } from '~/composables/usePhaseGeometry.client';
import type { useAutoCamera } from '~/composables/useAutoCamera.client';
import type { useWavPlayer } from '~/composables/useWavPlayer.client';
import type { TopologyMode } from '~/utils/topologies';

/* useLiveSession - the live-input feature as one unit.

   Owns the three-act session state machine (SETUP -> ARMED -> PLAYING -> DONE),
   the on-screen/MIDI note path, the scripted "ghost" demo, and the dock's
   narration/countdown. Creates and tears down the synth + MIDI input itself.

   The phase ref lives at the composition root (the page), because the camera's
   wavLoaded gate reads liveMode before this composable is constructed; this
   composable receives that ref and owns every transition on it. The page wires
   the rest by injecting the engine handles below. */

export type LivePhase = 'off' | 'setup' | 'armed' | 'playing' | 'done';

interface UseLiveSessionOptions {
    /** Session phase, owned at the composition root and shared with the camera. */
    livePhase: Ref<LivePhase>;
    geometry: ReturnType<typeof usePhaseGeometry>;
    camera: ReturnType<typeof useAutoCamera>;
    /** Read for narration; reset off the (live-incapable) attractor in setup. */
    topologyMode: Ref<TopologyMode>;
    /** The wav player - exitLive redraws a loaded track if there is one. */
    player: ReturnType<typeof useWavPlayer>;
    /** Stop any track playback: the stage belongs to one signal at a time. */
    stopPlayback: () => void;
}

export function useLiveSession(options: UseLiveSessionOptions) {
    const { livePhase, geometry, camera, topologyMode, player, stopPlayback } = options;

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

    // On-screen keys speak through the same monitor readout as hardware
    const playVirtualNote = (note: number, on: boolean) => {
        liveNote(note, 100, on);
        midi.lastEvent.value = { on, note, velocity: 100, device: 'on-screen', label: midiNoteName(note) };
    };

    // Act 1: the stage door. Synth + MIDI wake here so the card can name the
    // connected device; geometry waits for "Take the stage".
    const enterLiveSetup = async () => {
        stopPlayback(); // the stage belongs to one signal at a time
        if (topologyMode.value === 'attractor') topologyMode.value = 'corridor'; // card offers it greyed
        if (!(await synth.enable({ ringQuantum: geometry.corridorMeta.value.hopSize }))) return;
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
        camera.applyLiveCameraDefaults(); // live opens in Follow, not Orbit
        livePhase.value = 'armed';
    };

    const exitLive = () => {
        stopGhost();
        synth.disable();
        midi.disconnect();
        livePhase.value = 'off';
        // Hand the stage back: a loaded track redraws on play; otherwise idle
        if (player.audio.buffer) geometry.initFromBuffer(player.audio.buffer);
        else geometry.clear();
    };

    const toggleLive = () => {
        if (livePhase.value === 'off') void enterLiveSetup();
        else exitLive();
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
        const { live, frameCount, builtFrames } = geometry.corridorState.value;
        if (!live || !frameCount) return 0;
        return Math.min(1, builtFrames / frameCount);
    });
    const liveProgressLabel = computed(() => {
        const { frameCount, builtFrames, sr } = geometry.corridorState.value;
        const secondsLeft = ((frameCount - builtFrames) * geometry.corridorMeta.value.hopSize) / (sr || 48000);
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

    /* ---- Render-loop tick (called from the page's animate loop while live) ----
       Build live geometry from the synth's sample clock; the hard stop becomes
       an invitation by flipping PLAYING -> DONE once the canvas is full. */
    const updateBuild = () => {
        geometry.updateLiveBuild(synth.samplesWritten());
        const st = geometry.corridorState.value;
        if (livePhase.value === 'playing' && st.frameCount > 0 && st.builtFrames >= st.frameCount) {
            livePhase.value = 'done';
        }
    };

    onUnmounted(async () => {
        stopGhost();
        midi.disconnect();
        await synth.dispose();
    });

    return {
        liveDuration,
        // Synth/MIDI essentials, flattened so the page never reaches into them
        voice: synth.voice,
        activeVoiceCount: synth.activeVoiceCount,
        deviceNames: midi.deviceNames,
        lastEvent: midi.lastEvent,
        liveSource: synth.liveSource,
        // Ghost demo
        ghostActive,
        ghostLit,
        // Narration
        liveProgress,
        liveProgressLabel,
        livePrimaryLine,
        liveSecondaryLine,
        // Transitions
        enterLiveSetup,
        startSession,
        exitLive,
        toggleLive,
        playVirtualNote,
        playGhost,
        // Render-loop tick
        updateBuild,
    };
}
