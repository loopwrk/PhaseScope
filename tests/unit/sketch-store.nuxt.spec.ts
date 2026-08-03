// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { useSketchStore } from '~/composables/useSketchStore';

/* The store shares one persisted key, so this walks a single lifecycle
   rather than assuming a fresh library per test. */

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useSketchStore', () => {
    it('creates, renames, duplicates and removes sketches, persisting each step', async () => {
        const store = useSketchStore();

        const created = store.create({ name: 'dft-basis-sweep' });
        expect(store.get(created.id)?.name).toBe('dft-basis-sweep');
        await flush();
        expect(localStorage.getItem('phasescope:sketch:library')).toContain('dft-basis-sweep');

        store.rename(created.id, '  windowed-fft  ');
        expect(store.get(created.id)?.name).toBe('windowed-fft');

        const copy = store.duplicate(created.id);
        expect(copy?.id).not.toBe(created.id);
        expect(copy?.name).toBe('windowed-fft copy');
        expect(copy?.tabs).toEqual(store.get(created.id)?.tabs);

        store.remove(created.id);
        store.remove(copy!.id);
        expect(store.get(created.id)).toBeUndefined();
        await flush();
        expect(localStorage.getItem('phasescope:sketch:library')).not.toContain('windowed-fft');
    });

    it('renames blank input back to untitled', () => {
        const store = useSketchStore();
        const s = store.create({ name: 'keep' });
        store.rename(s.id, '   ');
        expect(store.get(s.id)?.name).toBe('untitled');
        store.remove(s.id);
    });

    it('duplicating an unknown id is a no-op', () => {
        const store = useSketchStore();
        const before = store.sketches.value.length;
        expect(store.duplicate('nope')).toBeUndefined();
        expect(store.sketches.value.length).toBe(before);
    });
});
