import type { RenderMode } from '~/composables/useCorridorRenderer.client';
import type { TopologyMode } from '~/composables/usePhaseGeometry.client';

/* useScopeSettings - the user's /phasescope settings, lifted into Nuxt's
   useState so they survive client-side navigation (a trip to /about and
   back must not reset the instrument). State, not storage: a hard reload
   still starts from the defaults.
 */
export function useScopeSettings() {
    return {
        renderMode: useState<RenderMode>('scope:render-mode', () => 'points'),
        topologyMode: useState<TopologyMode>('scope:topology', () => 'corridor'),
        showGoniometer: useState<boolean>('scope:goniometer', () => true),
        advancedOptionsOpen: useState<boolean>('scope:advanced-open', () => false),
        dreamBgEnabled: useState<boolean>('scope:dream-bg', () => false),
        heavenlyBgEnabled: useState<boolean>('scope:heavenly-bg', () => false),
    };
}
