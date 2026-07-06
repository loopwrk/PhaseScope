import type { RenderMode } from '~/composables/useCorridorRenderer.client';
import type { TopologyMode } from '~/utils/topologies';

export type BackgroundId = 'none' | 'dream' | 'starfield';

/* useScopeSettings - the page-level display settings, persisted via
   usePersistedState (useState + localStorage) so the instrument comes back
   as it was left, across navigation and reloads alike.

   These are only the keys the page itself owns: feature composables
   (useLissajous3D, useOscillation, useLiveSession, usePhaseGeometry, ...)
   declare their own - grep usePersistedState for the full set. */
export function useScopeSettings() {
    return {
        renderMode: usePersistedState<RenderMode>('scope:render-mode', () => 'points'),
        topologyMode: usePersistedState<TopologyMode>('scope:topology', () => 'corridor'),
        showGoniometer: usePersistedState<boolean>('scope:goniometer', () => true),
        advancedOptionsOpen: usePersistedState<boolean>('scope:advanced-open', () => false),
        background: usePersistedState<BackgroundId>('scope:background', () => 'starfield'),
    };
}
