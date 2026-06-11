/* usePersistedState - useState that remembers its player.

   Drop-in for useState on the scope:* settings keys: same reactive state
   shared by key, plus localStorage persistence so the instrument comes
   back exactly as it was left - topology, colours, thickness, all of it.

   Mechanics: on the client, the FIRST caller for a key hydrates the state
   from localStorage (a module-level registry stops later callers from
   re-hydrating or stacking watchers) and registers a deep watch that
   writes changes back. On the server (the /about page renders SSR) it
   behaves exactly like useState - no storage access.

   Storage is namespaced (`phasescope:` + key) and failures are swallowed:
   private-mode quota errors or corrupted JSON degrade to defaults, never
   to a crash. */

const STORAGE_PREFIX = 'phasescope:';
const hydratedKeys = new Set<string>();

export function usePersistedState<T>(key: string, defaultValue: () => T): Ref<T> {
    const state = useState<T>(key, defaultValue);

    if (import.meta.client && !hydratedKeys.has(key)) {
        hydratedKeys.add(key);
        const storageKey = STORAGE_PREFIX + key;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw !== null) state.value = JSON.parse(raw) as T;
        } catch {
            // corrupted entry: fall back to the default and let the watcher
            // overwrite it with something valid
        }
        watch(
            state,
            (value) => {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(value));
                } catch {
                    // storage full or unavailable (private mode) - run unpersisted
                }
            },
            { deep: true }
        );
    }

    return state;
}
