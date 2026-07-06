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
    const background = usePersistedState<BackgroundId>('scope:background', () => 'starfield');

    // Toggle a background on, or off if it is already the one showing (the
    // b shortcut's behaviour) - a settings rule, so it lives with the setting.
    const toggleBackground = (id: Exclude<BackgroundId, 'none'>) => {
        background.value = background.value === id ? 'none' : id;
    };

    return {
        renderMode: usePersistedState<RenderMode>('scope:render-mode', () => 'points'),
        topologyMode: usePersistedState<TopologyMode>('scope:topology', () => 'corridor'),
        showGoniometer: usePersistedState<boolean>('scope:goniometer', () => true),
        advancedOptionsOpen: usePersistedState<boolean>('scope:advanced-open', () => false),
        background,
        toggleBackground,
    };
}
