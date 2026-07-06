import { buildLocalPlaylist, isAudioFile, DEV_TRACK_ID_PREFIX } from '~/utils/localPlaylist';
import type { useWavPlayer } from '~/composables/useWavPlayer.client';
import type { usePlaybackOrchestration } from '~/composables/usePlaybackOrchestration.client';

/* useDevPlaylist - DEV-ONLY playback tools. Constructed by the page inside
   an import.meta.dev guard; nothing here ships.

   Two tools, one seam each:

   - Auto-play next: registers the wav player's (otherwise dangling)
     onTrackEnded hook and, while the toggle is on, steps the existing
     demo rotation forward. The selectedDemoTrackId guard keeps the
     orchestrator's contract intact: a user-loaded single file ending never
     hijacks playback into the rotation.

   - Folder playlists: a picked folder's audio files become object-URL-backed
     DemoTracks (see utils/localPlaylist) injected into the orchestrator's
     catalogue, where the whole shipped pipeline - menu groups, selection,
     { } rotation, media keys, auto-advance - handles them as if they were
     demos. Opening a folder replaces the previous dev playlist (and revokes
     its object URLs); playlists live for the session only. */

interface UseDevPlaylistOptions {
    player: ReturnType<typeof useWavPlayer>;
    playback: ReturnType<typeof usePlaybackOrchestration>;
}

export function useDevPlaylist(options: UseDevPlaylistOptions) {
    const { player, playback } = options;
    const { show: showToast } = usePsToast();

    const autoAdvance = usePersistedState('dev:auto-advance', () => false);

    player.onTrackEnded(() => {
        if (autoAdvance.value && playback.selectedDemoTrackId.value) playback.playAdjacentTrack(1);
    });

    let objectUrls: string[] = [];

    const clearPlaylist = () => {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        objectUrls = [];
        playback.demoTracks.value = playback.demoTracks.value.filter((t) => !t.id.startsWith(DEV_TRACK_ID_PREFIX));
    };

    const openFolder = (files: File[]) => {
        // Filter BEFORE creating object URLs, so cover art / .DS_Store and
        // friends never get a URL to leak.
        const entries = files
            .filter((f) => isAudioFile(f.name))
            .map((f) => ({
                relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
                url: URL.createObjectURL(f),
            }));
        // A mis-picked folder must not destroy the playlist you have
        if (!entries.length) {
            showToast('warning', 'No audio in folder', 'Nothing there matched the audio extensions.');
            return;
        }

        clearPlaylist();
        objectUrls = entries.map((e) => e.url);
        const tracks = buildLocalPlaylist(entries);
        playback.demoTracks.value = [...tracks, ...playback.demoTracks.value];

        // Load (not play) the first track, matching the select menu's contract
        const first = tracks[0];
        if (first) playback.handleSelectDemoTrack(first.id);
        showToast('success', 'Dev playlist loaded', `${tracks.length} track${tracks.length === 1 ? '' : 's'}`);
    };

    const trackCount = computed(
        () => playback.demoTracks.value.filter((t) => t.id.startsWith(DEV_TRACK_ID_PREFIX)).length
    );

    onUnmounted(clearPlaylist);

    return { autoAdvance, openFolder, trackCount };
}
