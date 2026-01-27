import type { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import type { ShallowRef, Ref } from "vue";
import { useEventListener } from "@vueuse/core";

interface UsePointerLockCameraOptions {
  onLock?: () => void;
  onUnlock?: () => void;
}

export function usePointerLockCamera(
  controls: ShallowRef<PointerLockControls | null>,
  targetElement: Ref<HTMLElement | null>,
  options: UsePointerLockCameraOptions = {},
) {
  if (import.meta.server) {
    return {
      isLocked: ref(false),
      lock: () => {},
      unlock: () => {},
    };
  }

  const { onLock, onUnlock } = options;
  const isLocked = ref(false);

  // Update locked state when pointer lock changes
  useEventListener(document, "pointerlockchange", () => {
    const locked = !!document.pointerLockElement;
    isLocked.value = locked;

    if (locked && onLock) {
      onLock();
    } else if (!locked && onUnlock) {
      onUnlock();
    }
  });

  // Handle pointer lock errors
  useEventListener(document, "pointerlockerror", () => {
    if (import.meta.dev) console.warn("Pointer lock error");
  });

  // Click target element to lock pointer
  useEventListener(targetElement, "click", () => {
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
