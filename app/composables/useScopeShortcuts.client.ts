import type { Ref } from 'vue';
import type { RenderMode } from '~/composables/useCorridorRenderer.client';
import type { BackgroundId } from '~/composables/useScopeSettings';

/* useScopeShortcuts - the visualiser's whole keymap in one place.

   | Key       | Action                               |
   | --------- | ------------------------------------ |
   | Enter     | Play / Pause                         |
   | r         | Render mode (points <-> lines)       |
   | o         | Toggle oscillation                   |
   | c         | Cycle camera (orbit/follow/free)     |
   | f         | Toggle fullscreen                    |
   | b         | Toggle Dream background              |
   | g         | Toggle goniometer                    |
   | h         | Toggle controls overlay              |
   | { / }     | Previous / next demo track           |

   (Movement keys - WASD, arrows, [ ] speed - live in useKeyboardMovement;
   this is the toggle layer.) Everything is injected, so the keymap reads as
   a table of bindings rather than a closure over page state. Returns the
   underlying useKeyboardShortcuts instance for ad-hoc additions. */

interface UseScopeShortcutsOptions {
    renderMode: Ref<RenderMode>;
    /** Lines are unavailable while the stereo field is split - guards `r`. */
    channelBias: Ref<boolean>;
    oscillationEnabled: Ref<boolean>;
    showGoniometer: Ref<boolean>;
    toggleFullscreen: () => void;
    handlePlayPause: () => unknown;
    toggleControls: () => void;
    toggleCameraMode: () => void;
    toggleBackground: (id: Exclude<BackgroundId, 'none'>) => void;
    playAdjacentTrack: (direction: 1 | -1) => void;
}

export function useScopeShortcuts(options: UseScopeShortcutsOptions) {
    const shortcuts = useKeyboardShortcuts();

    shortcuts.register('enter', () => {
        options.handlePlayPause();
    });
    shortcuts.register('r', () => {
        if (options.channelBias.value) return; // lines unavailable while the field is split
        options.renderMode.value = options.renderMode.value === 'points' ? 'lines' : 'points';
    });
    shortcuts.register('o', () => {
        options.oscillationEnabled.value = !options.oscillationEnabled.value;
    });
    shortcuts.register('c', () => {
        options.toggleCameraMode();
    });
    shortcuts.register('f', () => {
        options.toggleFullscreen();
    });
    shortcuts.register('b', () => options.toggleBackground('dream'));
    shortcuts.register('g', () => {
        options.showGoniometer.value = !options.showGoniometer.value;
    });
    shortcuts.register('h', () => {
        options.toggleControls();
    });
    shortcuts.register('{', () => options.playAdjacentTrack(-1));
    shortcuts.register('}', () => options.playAdjacentTrack(1));

    return shortcuts;
}
