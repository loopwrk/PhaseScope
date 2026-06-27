import type { RenderMode } from '~/composables/useCorridorRenderer.client';
import type { TopologyMode } from '~/utils/topologies';

export type BackgroundId = 'none' | 'dream' | 'starfield';

/* useScopeSettings - the user's visualiser settings, lifted into Nuxt's
   useState so they survive client-side navigation (a trip to /about and
   back must not reset the instrument). State, not storage: a hard reload
   still starts from the defaults.
 */
export function useScopeSettings() {
    return {
        renderMode: usePersistedState<RenderMode>('scope:render-mode', () => 'points'),
        topologyMode: usePersistedState<TopologyMode>('scope:topology', () => 'corridor'),
        showGoniometer: usePersistedState<boolean>('scope:goniometer', () => true),
        advancedOptionsOpen: usePersistedState<boolean>('scope:advanced-open', () => false),
        background: usePersistedState<BackgroundId>('scope:background', () => 'starfield'),
    };
}
