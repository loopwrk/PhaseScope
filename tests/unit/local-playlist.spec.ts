import { describe, it, expect } from 'vitest';
import { buildLocalPlaylist, isAudioFile, DEV_TRACK_ID_PREFIX } from '~/utils/localPlaylist';

/* The dev folder-playlist builder. Its conventions deliberately mirror the
   audio manifest's (numbered prefixes, subfolder groups), so these tests
   double as a spec of that shared grammar. */

const entry = (relativePath: string) => ({ relativePath, url: `blob:${relativePath}` });

describe('isAudioFile', () => {
    it('accepts the manifest extension list, case-insensitively', () => {
        for (const name of ['a.mp3', 'b.WAV', 'c.flac', 'd.M4A']) expect(isAudioFile(name)).toBe(true);
    });

    it('rejects everything else', () => {
        for (const name of ['cover.jpg', 'notes.txt', '.DS_Store', 'song.mp3.bak']) {
            expect(isAudioFile(name)).toBe(false);
        }
    });
});

describe('buildLocalPlaylist', () => {
    it('filters non-audio files out', () => {
        const tracks = buildLocalPlaylist([entry('Set/01 A.mp3'), entry('Set/cover.jpg'), entry('Set/.DS_Store')]);
        expect(tracks.map((t) => t.name)).toEqual(['A']);
    });

    it('strips numbered prefixes into ordering metadata', () => {
        const tracks = buildLocalPlaylist([entry('Set/02 Later.mp3'), entry('Set/01 Sooner.mp3')]);
        expect(tracks.map((t) => t.name)).toEqual(['Sooner', 'Later']);
        expect(tracks.map((t) => t.order)).toEqual([1, 2]);
    });

    it('sorts unnumbered files alphabetically after numbered ones', () => {
        const tracks = buildLocalPlaylist([entry('Set/Zeta.mp3'), entry('Set/Alpha.mp3'), entry('Set/03 Named.mp3')]);
        expect(tracks.map((t) => t.name)).toEqual(['Named', 'Alpha', 'Zeta']);
    });

    it('groups root files under the picked folder and subfolder files under the subfolder', () => {
        const tracks = buildLocalPlaylist([entry('Crate/01 Root.mp3'), entry('Crate/01 Deep/01 Sub.mp3')]);
        const byName = Object.fromEntries(tracks.map((t) => [t.name, t.group]));
        expect(byName).toEqual({ Root: 'Crate', Sub: 'Deep' });
    });

    it('orders groups by their numbered prefixes and keeps them contiguous', () => {
        const tracks = buildLocalPlaylist([
            entry('Crate/02 Second/a.mp3'),
            entry('Crate/01 First/b.mp3'),
            entry('Crate/02 Second/b.mp3'),
        ]);
        expect(tracks.map((t) => t.group)).toEqual(['First', 'Second', 'Second']);
        expect(tracks[0]!.groupOrder).toBeLessThan(tracks[1]!.groupOrder);
    });

    it('groups bare paths (no folder info) under "Local"', () => {
        const tracks = buildLocalPlaylist([entry('loose.wav')]);
        expect(tracks[0]!.group).toBe('Local');
    });

    it('assigns groupOrders below every shipped group so dev playlists list first', () => {
        const tracks = buildLocalPlaylist([entry('Set/a.mp3')]);
        expect(tracks[0]!.groupOrder).toBeLessThan(0);
    });

    it('derives stable, prefixed ids from the relative path', () => {
        const tracks = buildLocalPlaylist([entry('Set/01 A.mp3')]);
        expect(tracks[0]!.id).toBe(`${DEV_TRACK_ID_PREFIX}Set/01 A.mp3`);
    });
});
