import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineNuxtModule } from '@nuxt/kit';

const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];

const isAudio = (file: string) => AUDIO_EXTS.some((ext) => file.toLowerCase().endsWith(ext));
const stripExt = (file: string) => file.replace(/\.[^/.]+$/, '');

/** "01 Harmonic" -> { order: 1, label: "Harmonic" }. The leading number is
 *  ordering metadata only; the rest is the display name, verbatim (filenames
 *  are already cased exactly as they should appear). Missing number sorts last. */
function parseOrdered(base: string): { order: number; label: string } {
    const match = /^(\d+)\s+(.*)$/.exec(base);
    if (match) return { order: parseInt(match[1]!, 10), label: match[2]!.trim() };
    return { order: Number.MAX_SAFE_INTEGER, label: base.trim() };
}

interface ManifestTrack {
    id: string;
    name: string;
    file: string;
    group: string;
    groupOrder: number;
    order: number;
}

function generateAudioManifest(rootDir: string): number {
    const audioDir = join(rootDir, 'public', 'audio');
    let entries: ReturnType<typeof readdirSync<{ withFileTypes: true }>>;
    try {
        entries = readdirSync(audioDir, { withFileTypes: true });
    } catch {
        entries = [];
    }

    // Each subfolder of public/audio is a category (a "group" in the demo
    // menu): its number sets the order groups appear in, its name (number
    // stripped) IS the group label.
    const folders = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({ dir: entry.name, ...parseOrdered(entry.name) }))
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

    // Tracks are emitted folder-by-folder, ordered within each folder by file
    // number, so the flat list is already in menu order (group then track).
    const tracks: ManifestTrack[] = [];
    for (const folder of folders) {
        let files: string[];
        try {
            files = readdirSync(join(audioDir, folder.dir));
        } catch {
            files = [];
        }
        files
            .filter(isAudio)
            .map((file) => ({ file, ...parseOrdered(stripExt(file)) }))
            .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
            .forEach((track) => {
                const rel = `${folder.dir}/${track.file}`;
                tracks.push({
                    id: `auto-${rel}`,
                    name: track.label,
                    file: `/audio/${rel}`,
                    group: folder.label,
                    groupOrder: folder.order,
                    order: track.order,
                });
            });
    }

    writeFileSync(join(rootDir, 'public', 'audio-manifest.json'), JSON.stringify(tracks));
    return tracks.length;
}

export default defineNuxtModule({
    meta: { name: 'audio-manifest' },
    setup(_options, nuxt) {
        const count = generateAudioManifest(nuxt.options.rootDir);
        console.log(`[audio-manifest] ${count} tracks`);
    },
});
