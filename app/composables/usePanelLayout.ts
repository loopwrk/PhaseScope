import type { ComputedRef, Ref } from 'vue';

/* usePanelLayout - the floating panels' visibility choreography.

   One home for the rules that decide which overlay panels are showing:

   - Desktop shows the settings + controls panels by default; phones start
     with them collapsed (they overlay the canvas) and open them from the
     header. Crossing the breakpoint re-applies the default for that side.
   - The goniometer + waveform are large, so crossing to a phone forces them
     off; desktop keeps its own (persisted) state and isn't reset on resize.
   - On phones the settings and controls panels are mutually exclusive so
     they never stack.
   - Phones only, in the 3D scope: the scope chip's gear button toggles the
     scope-settings overlay; opening it closes the display settings (the same
     never-stack rule), and entering the scope always starts with the cube
     clear. Desktop shows the scope settings inline and never uses this. */

interface UsePanelLayoutOptions {
    isDesktop: Ref<boolean> | ComputedRef<boolean>;
    /** The persisted goniometer toggle (scope:goniometer) - forced off on phones. */
    showGoniometer: Ref<boolean>;
    /** The 3D Lissajous scope flag - entering clears the scope-settings overlay. */
    scope3d: Ref<boolean>;
}

export function usePanelLayout(options: UsePanelLayoutOptions) {
    const { isDesktop, showGoniometer, scope3d } = options;

    const showControlsOverlay = ref(true);
    const showSettings = ref(true);
    const showScopeSettings = ref(false);

    watch(
        isDesktop,
        (desktop) => {
            showControlsOverlay.value = desktop;
            showSettings.value = desktop;
            if (!desktop) showGoniometer.value = false;
        },
        { immediate: true }
    );

    // Enter the scope with the cube clear; the gear reveals the panel on demand
    watch(scope3d, (active) => {
        if (active) showScopeSettings.value = false;
    });

    const toggleControls = () => {
        showControlsOverlay.value = !showControlsOverlay.value;
        if (!isDesktop.value && showControlsOverlay.value) showSettings.value = false;
    };

    const toggleSettings = () => {
        showSettings.value = !showSettings.value;
        if (!isDesktop.value && showSettings.value) showControlsOverlay.value = false;
    };

    const toggleScopeSettings = () => {
        showScopeSettings.value = !showScopeSettings.value;
        if (showScopeSettings.value) showSettings.value = false;
    };

    return {
        showControlsOverlay,
        showSettings,
        showScopeSettings,
        toggleControls,
        toggleSettings,
        toggleScopeSettings,
    };
}
