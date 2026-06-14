import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineNuxtModule } from '@nuxt/kit';
import { useTitleCase } from '../app/composables/useTitleCase';

const { toTitleCase } = useTitleCase();

const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];

function classifyTrack(base: string): { group: string; name: string } {
    if (base.startsWith('z_')) return { group: 'Experimental', name: toTitleCase(base.slice(2)) };
    if (base.startsWith('y_')) return { group: 'Genres', name: toTitleCase(base.slice(2)) };
    return { group: 'Stable/Harmonic', name: toTitleCase(base) };
}

function generateAudioManifest(rootDir: string): number {
    const audioDir = join(rootDir, 'public', 'audio');
    let files: string[];
    try {
        files = readdirSync(audioDir);
    } catch {
        files = [];
    }
    const audioFiles = files
        .filter((file) => AUDIO_EXTS.some((ext) => file.toLowerCase().endsWith(ext)))
        .sort((a, b) => {
            const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? '', 10);
            const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? '', 10);
            const hasNumA = !isNaN(numA);
            const hasNumB = !isNaN(numB);
            if (hasNumA && hasNumB) return numA - numB || a.localeCompare(b);
            if (hasNumA) return -1;
            if (hasNumB) return 1;
            return a.localeCompare(b);
        })
        .map((file, index) => {
            const { group, name } = classifyTrack(file.replace(/\.[^/.]+$/, ''));
            return {
                id: `auto-${file}`,
                name,
                file: `/audio/${file}`,
                group,
                corridorOrder: index + 1,
                sphereOrder: index + 1,
            };
        });
    writeFileSync(join(rootDir, 'public', 'audio-manifest.json'), JSON.stringify(audioFiles));
    return audioFiles.length;
}

export default defineNuxtModule({
    meta: { name: 'audio-manifest' },
    setup(_options, nuxt) {
        const count = generateAudioManifest(nuxt.options.rootDir);
        console.log(`[audio-manifest] ${count} tracks`);
    },
});
