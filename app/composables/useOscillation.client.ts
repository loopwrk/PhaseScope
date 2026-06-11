import type { OscillationMode } from '~/utils/oscillation';

export type { OscillationMode };

/* useOscillation - the user's oscillation controls.

   The displacement itself runs on the GPU: useCorridorRenderer injects a
   vertex-shader patch driven by uniforms (utils/oscillation.ts is its
   testable TypeScript reference - keep them in lockstep). These settings
   are useState-backed so they survive navigation; keys are documented in
   useScopeSettings. Disabling is a uniform write, so points return to
   their anchors instantly - no restore pass needed. */
export function useOscillation() {
    const enabled = useState('scope:oscillation-enabled', () => true);
    const mode = useState<OscillationMode>('scope:oscillation-mode', () => 'wave');

    return { enabled, mode };
}
