// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { usePersistedState } from '~/composables/usePersistedState';

/* The persistence layer under every scope:* setting. Keys here are
   test-local so they never collide with real settings keys. */

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('usePersistedState', () => {
    it('writes changes to localStorage under the phasescope namespace', async () => {
        const state = usePersistedState('test:write', () => 'initial');
        state.value = 'changed';
        await flush();
        expect(localStorage.getItem('phasescope:test:write')).toBe('"changed"');
    });

    it('hydrates from localStorage on first use', () => {
        localStorage.setItem('phasescope:test:hydrate', JSON.stringify({ pointsPerFrame: 256 }));
        const state = usePersistedState('test:hydrate', () => ({ pointsPerFrame: 512 }));
        expect(state.value.pointsPerFrame).toBe(256);
    });

    it('persists deep mutations of object settings', async () => {
        const state = usePersistedState('test:deep', () => ({ zStep: 0.08 }));
        state.value.zStep = 0.16;
        await flush();
        expect(JSON.parse(localStorage.getItem('phasescope:test:deep')!).zStep).toBe(0.16);
    });

    it('shares state across call sites without re-hydrating', async () => {
        const a = usePersistedState('test:shared', () => 1);
        a.value = 2;
        await flush();
        localStorage.setItem('phasescope:test:shared', '99'); // late external write
        const b = usePersistedState('test:shared', () => 1); // must NOT re-hydrate
        expect(b.value).toBe(2);
        expect(a).toStrictEqual(b);
    });

    it('falls back to the default on corrupted storage', () => {
        localStorage.setItem('phasescope:test:corrupt', '{not json');
        const state = usePersistedState('test:corrupt', () => 'safe');
        expect(state.value).toBe('safe');
    });
});
