import type { Ref } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import type { useThree } from '~/composables/useThree.client';
import type { usePhaseGeometry, TopologyMode } from '~/composables/usePhaseGeometry.client';
import type { useAutoCamera } from '~/composables/useAutoCamera.client';

/* usePlaybackOrchestration - everything between "the user wants to hear
   something" and "the engine is building geometry for it".

   Wraps the wav player and demo-track catalogue, owns the load / play /
   pause / stop flows (including re-initialising geometry on fresh starts
   and the per-topology camera reset on load), the demo-track rotation
   ({ } shortcuts, hardware media keys, end-of-track auto-advance), and
   the transport's elapsed readout. */

interface UsePlaybackOrchestrationOptions {
    three: ReturnType<typeof useThree>;
    geometry: ReturnType<typeof usePhaseGeometry>;
    camera: ReturnType<typeof useAutoCamera>;
    topologyMode: Ref<TopologyMode>;
    /** The wav player instance - created by the page, since the geometry
     *  engine also derives its point budget from the player's audio state. */
    player: ReturnType<typeof useWavPlayer>;
}

export function usePlaybackOrchestration(options: UsePlaybackOrchestrationOptions) {
    const { three, geometry, camera, topologyMode, player } = options;

    const { show: showToast } = usePsToast();

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
    } = player;

    // Demo tracks
    const { tracks: demoTracks, loadDemoTrack, isLoading: demoTracksLoading } = useDemoTracks();
    const sortedDemoTracks = computed(() => {
        const orderKey = topologyMode.value === 'sphere' ? 'sphereOrder' : 'corridorOrder';
        return [...demoTracks.value].sort((a, b) => a[orderKey] - b[orderKey]);
    });

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

    /* ---------- Loading ---------- */

    const loadWavFile = async (file: File) => {
        stopAllAudio();
        geometry.clear();

        await loadWavFileBase(file);

        // Build the 3D snapshot corridor progressively as playback advances
        if (audio.buffer) {
            geometry.initFromBuffer(audio.buffer);
        }

        camera.resetOrbitClock();

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
        }
        camera.applyTopologyCameraDefaults();
    };

    const onAudioLoadError = (error: Error) => {
        showToast('error', 'Failed to load audio', error.message);
    };

    /* ---------- Transport ---------- */

    const handlePlay = async () => {
        // If paused (started but no active source), resume from saved position
        if (audio.started && !audio.source) {
            await resumeAudio();
        } else {
            // Fresh playback - always re-initialize corridor to ensure arrays
            // are sized correctly for current settings (pointsPerFrame, trackCoverage, etc.)
            if (audio.buffer) {
                geometry.initFromBuffer(audio.buffer);
                camera.applyTopologyCameraDefaults();
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
        geometry.clear();
    };

    /** Unload the track entirely - back to the idle fork (the logo's
     *  way home from listening). */
    const unloadTrack = () => {
        handleStop();
        autoPlayIndex.value = -1;
        audio.buffer = null;
        wavLoaded.value = false;
    };

    /* ---------- Demo-track rotation ---------- */

    // Auto-play: play tracks sequentially, looping back to start
    const autoPlayIndex = ref(-1);
    const selectedDemoTrackId = computed(() =>
        autoPlayIndex.value >= 0 ? (sortedDemoTracks.value[autoPlayIndex.value]?.id ?? null) : null
    );

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

    const playAutoTrackAtIndex = async (index: number) => {
        const tracks = sortedDemoTracks.value;
        const track = tracks[index];
        if (!track) return;
        autoPlayIndex.value = index;
        const loaded = await handleLoadDemoTrack(track.id);
        if (!loaded) return;
        await handlePlay();
    };

    // Choosing a track from the transport's select only LOADS it - playback is
    // an explicit action on the play button. The flow-through cases (the { }
    // shortcuts, hardware media keys, end-of-track auto-advance) still play
    // immediately via playAutoTrackAtIndex, since they happen mid-listening.
    const handleSelectDemoTrack = (trackId: string) => {
        void handleLoadDemoTrack(trackId);
    };

    // Loading a user file leaves the demo-track rotation entirely: clear the
    // rotation index so end-of-track auto-advance doesn't hijack playback into
    // the demo list, and the select returns to its placeholder.
    const handleLoadFile = (file: File) => {
        autoPlayIndex.value = -1;
        loadWavFile(file).catch(onAudioLoadError);
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

    /* ---------- Hardware media keys ---------- */

    // Media Session API - handles hardware media keys on macOS (and other OSes).
    // Registered from the page's onMounted.
    const initMediaSessionHandlers = () => {
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.setActionHandler('nexttrack', () => playAdjacentTrack(1));
        navigator.mediaSession.setActionHandler('previoustrack', () => playAdjacentTrack(-1));
    };

    const clearMediaSessionHandlers = () => {
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
    };

    const dispose = async () => {
        await disposeWavPlayer();
        geometry.clear();
        clearMediaSessionHandlers();
    };

    return {
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
        dispose,
    };
}
