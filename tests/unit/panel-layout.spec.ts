import { describe, it, expect } from 'vitest';
import { ref, nextTick } from 'vue';
import { usePanelLayout } from '~/composables/usePanelLayout';

/* The floating panels' visibility rules: desktop defaults, phone
   collapse-and-exclude, and the 3D scope's clear-on-entry. All state is
   injected, so the choreography tests as plain reactivity. */

const mount = (desktop: boolean) => {
    const isDesktop = ref(desktop);
    const showGoniometer = ref(true);
    const scope3d = ref(false);
    const layout = usePanelLayout({ isDesktop, showGoniometer, scope3d });
    return { isDesktop, showGoniometer, scope3d, ...layout };
};

describe('usePanelLayout', () => {
    it('opens both side panels on desktop and leaves the goniometer alone', () => {
        const p = mount(true);
        expect(p.showControlsOverlay.value).toBe(true);
        expect(p.showSettings.value).toBe(true);
        expect(p.showGoniometer.value).toBe(true);
    });

    it('starts phones collapsed with the goniometer forced off', () => {
        const p = mount(false);
        expect(p.showControlsOverlay.value).toBe(false);
        expect(p.showSettings.value).toBe(false);
        expect(p.showGoniometer.value).toBe(false);
    });

    it('re-applies the phone defaults when crossing the breakpoint down', async () => {
        const p = mount(true);
        p.isDesktop.value = false;
        await nextTick();
        expect(p.showControlsOverlay.value).toBe(false);
        expect(p.showSettings.value).toBe(false);
        expect(p.showGoniometer.value).toBe(false);
    });

    it('never stacks the two panels on phones (opening one closes the other)', () => {
        const p = mount(false);
        p.toggleControls();
        expect(p.showControlsOverlay.value).toBe(true);
        p.toggleSettings();
        expect(p.showSettings.value).toBe(true);
        expect(p.showControlsOverlay.value).toBe(false);
        p.toggleControls();
        expect(p.showControlsOverlay.value).toBe(true);
        expect(p.showSettings.value).toBe(false);
    });

    it('lets the panels coexist on desktop', () => {
        const p = mount(true);
        p.toggleControls(); // close
        p.toggleControls(); // reopen - settings stayed open throughout
        expect(p.showControlsOverlay.value).toBe(true);
        expect(p.showSettings.value).toBe(true);
    });

    it('enters the 3D scope with the scope-settings overlay clear', async () => {
        const p = mount(false);
        p.toggleScopeSettings();
        expect(p.showScopeSettings.value).toBe(true);
        p.scope3d.value = true;
        await nextTick();
        expect(p.showScopeSettings.value).toBe(false);
    });

    it('closes the display settings when the scope settings open', () => {
        const p = mount(false);
        p.toggleSettings();
        expect(p.showSettings.value).toBe(true);
        p.toggleScopeSettings();
        expect(p.showScopeSettings.value).toBe(true);
        expect(p.showSettings.value).toBe(false);
    });
});
