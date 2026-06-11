import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { ShallowRef, Ref } from 'vue';
import { useEventListener } from '@vueuse/core';

interface UsePointerLockCameraOptions {
    onLock?: () => void;
    onUnlock?: () => void;
    /** While true, clicks do not acquire pointer lock (2D scope mode) */
    disabled?: Ref<boolean>;
}

export function usePointerLockCamera(
    controls: ShallowRef<PointerLockControls | null>,
    targetElement: Ref<HTMLElement | null>,
    options: UsePointerLockCameraOptions = {}
) {
    const { onLock, onUnlock, disabled } = options;
    const isLocked = ref(false);

    // Update locked state when pointer lock changes
    useEventListener(document, 'pointerlockchange', () => {
        const locked = !!document.pointerLockElement;
        isLocked.value = locked;

        if (locked && onLock) {
            onLock();
        } else if (!locked && onUnlock) {
            onUnlock();
        }
    });

    // Handle pointer lock errors
    useEventListener(document, 'pointerlockerror', () => {
        if (import.meta.dev) console.warn('Pointer lock error');
    });

    // Click target element to lock pointer
    useEventListener(targetElement, 'click', () => {
        if (disabled?.value) return;
        const ctl = controls.value;
        if (ctl && !isLocked.value) {
            ctl.lock();
        }
    });

    const lock = () => {
        const ctl = controls.value;
        if (ctl) {
            ctl.lock();
        }
    };

    const unlock = () => {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    };

    return {
        isLocked,
        lock,
        unlock,
    };
}
