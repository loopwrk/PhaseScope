import type { RenderMode } from '~/composables/useCorridorRenderer.client';
import type { TopologyMode } from '~/composables/usePhaseGeometry.client';

/* useScopeSettings - the user's /phasescope settings, lifted into Nuxt's
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
        dreamBgEnabled: usePersistedState<boolean>('scope:dream-bg', () => false),
        heavenlyBgEnabled: usePersistedState<boolean>('scope:heavenly-bg', () => false),
    };
}
