import type { DemoTrack } from '~/composables/useDemoTracks';

/* Local folder -> playlist (dev tooling). Turns a picked folder's file
   entries into DemoTracks that flow through the whole existing pipeline
   (menu grouping, selection, rotation, auto-advance) untouched - which also
   makes it a live preview of how a candidate folder would look shipped.

   Conventions deliberately mirror the audio manifest's (modules/
   audio-manifest.ts): "01 Foo" leading numbers are ordering metadata with
   the label shown verbatim, files directly in the picked folder group under
   the folder's name, and files in an immediate subfolder group under the
   subfolder's name. parseOrdered + the extension list are duplicated from
   the manifest module - it imports node:fs at top level, so it cannot be
   shared into client code; keep the two in step. */

const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];

export const isAudioFile = (name: string): boolean => AUDIO_EXTS.some((ext) => name.toLowerCase().endsWith(ext));

const stripExt = (file: string) => file.replace(/\.[^/.]+$/, '');

/** "01 Harmonic" -> { order: 1, label: "Harmonic" }; missing number sorts last. */
const parseOrdered = (base: string): { order: number; label: string } => {
    const match = /^(\d+)\s+(.*)$/.exec(base);
    if (match) return { order: parseInt(match[1]!, 10), label: match[2]!.trim() };
    return { order: Number.MAX_SAFE_INTEGER, label: base.trim() };
};

/** Well below every shipped groupOrder, so dev playlists list first. */
const DEV_GROUP_ORDER_BASE = -1000;

/** ids get this prefix; the dev composable filters its tracks back out by it. */
export const DEV_TRACK_ID_PREFIX = 'dev-';

export interface LocalPlaylistEntry {
    /** Path as picked: "Folder/01 A.mp3", "Folder/02 Sub/01 B.mp3", or a bare
     *  "track.mp3" when the browser gives no relative path. */
    relativePath: string;
    /** A fetchable URL for the file (an object URL in practice). */
    url: string;
}

export const buildLocalPlaylist = (entries: LocalPlaylistEntry[]): DemoTrack[] => {
    // Group by the file's home: the immediate subfolder if there is one, the
    // picked folder itself for root files, "Local" for bare paths. One level,
    // like public/audio; anything deeper still groups under the first subfolder.
    const parsed = entries
        .filter((e) => isAudioFile(e.relativePath))
        .map((e) => {
            const segments = e.relativePath.split('/');
            const file = segments[segments.length - 1]!;
            const groupName = segments.length >= 3 ? segments[1]! : segments[0] === file ? 'Local' : segments[0]!;
            return { entry: e, group: parseOrdered(groupName), track: parseOrdered(stripExt(file)) };
        });

    // Groups sort by their number-then-label and take sequential groupOrders
    // from the dev base, so the flat list stays contiguous per group.
    const groupKeys = [...new Map(parsed.map((p) => [p.group.label, p.group])).values()].sort(
        (a, b) => a.order - b.order || a.label.localeCompare(b.label)
    );
    const groupOrders = new Map(groupKeys.map((g, i) => [g.label, DEV_GROUP_ORDER_BASE + i]));

    return parsed
        .sort(
            (a, b) =>
                groupOrders.get(a.group.label)! - groupOrders.get(b.group.label)! ||
                a.track.order - b.track.order ||
                a.track.label.localeCompare(b.track.label)
        )
        .map((p) => ({
            id: `${DEV_TRACK_ID_PREFIX}${p.entry.relativePath}`,
            name: p.track.label,
            file: p.entry.url,
            group: p.group.label,
            groupOrder: groupOrders.get(p.group.label)!,
            order: p.track.order,
        }));
};
