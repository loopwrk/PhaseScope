import { useMagicKeys } from "@vueuse/core";
import type { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import type { ShallowRef, ComputedRef } from "vue";

interface UseKeyboardMovementOptions {
  normalSpeed?: number;
  boostSpeed?: number;
  minHeight?: number;
  onMovement?: () => void;
}

// Helper to safely get a key ref with fallback
const getKeyRef = (
  keys: ReturnType<typeof useMagicKeys>,
  key: string,
): ComputedRef<boolean> => {
  const keyRef = keys[key];
  return computed(() => (keyRef ? unref(keyRef) : false));
};

export function useKeyboardMovement(
  controls: ShallowRef<PointerLockControls | null>,
  options: UseKeyboardMovementOptions = {},
) {
  if (import.meta.server) {
    return {
      isMoving: ref(false),
      update: () => {},
    };
  }

  const {
    normalSpeed = 4.0,
    boostSpeed = 7.5,
    minHeight = 0.3,
    onMovement,
  } = options;

  const keys = useMagicKeys();

  // Movement keys with safe fallbacks
  const forward = getKeyRef(keys, "w");
  const backward = getKeyRef(keys, "s");
  const left = getKeyRef(keys, "a");
  const right = getKeyRef(keys, "d");
  const up = getKeyRef(keys, "space");
  const down = getKeyRef(keys, "shift");
  const boost = getKeyRef(keys, "control");

  // Track if any movement key is pressed
  const isMoving = computed(
    () =>
      forward.value ||
      backward.value ||
      left.value ||
      right.value ||
      up.value ||
      down.value,
  );

  // Trigger callback when movement starts
  watch(isMoving, (moving) => {
    if (moving && onMovement) {
      onMovement();
    }
  });

  const update = (deltaTime: number) => {
    const ctl = controls.value;
    if (!ctl) return;

    const speed = boost.value ? boostSpeed : normalSpeed;
    const distance = speed * deltaTime;

    // Forward/backward
    if (forward.value) ctl.moveForward(distance);
    if (backward.value) ctl.moveForward(-distance);

    // Left/right strafe
    if (left.value) ctl.moveRight(-distance);
    if (right.value) ctl.moveRight(distance);

    // Vertical movement
    const camObj = (ctl as any).getObject?.() ?? (ctl as any).object;
    if (camObj) {
      if (up.value) camObj.position.y += distance;
      if (down.value) camObj.position.y -= distance;

      // Clamp to minimum height
      camObj.position.y = Math.max(minHeight, camObj.position.y);
    }
  };

  return {
    isMoving,
    update,
  };
}
