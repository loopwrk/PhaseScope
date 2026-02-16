import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export default defineEventHandler(async () => {
    // Only allow in development
    if (!import.meta.dev) {
        throw createError({
            statusCode: 404,
            message: 'Not found',
        });
    }

    try {
        const audioDir = join(process.cwd(), 'public', 'audio');
        const files = await readdir(audioDir);

        const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        const audioFiles = files
            .filter((file: string) => audioExtensions.some((ext) => file.toLowerCase().endsWith(ext)))
            .sort((a: string, b: string) => {
                const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? '', 10);
                const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? '', 10);
                const hasNumA = !isNaN(numA);
                const hasNumB = !isNaN(numB);
                if (hasNumA && hasNumB) return numA - numB || a.localeCompare(b);
                if (hasNumA) return -1;
                if (hasNumB) return 1;
                return a.localeCompare(b);
            })
            .map((file: string, index: number) => ({
                id: `auto-${file}`,
                name: file.replace(/\.[^/.]+$/, ''),
                file: `/audio/${file}`,
                corridorOrder: index + 1,
                sphereOrder: index + 1,
            }));

        return audioFiles;
    } catch (error) {
        return [];
    }
});
