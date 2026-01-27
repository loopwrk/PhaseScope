import { useMagicKeys, useEventListener } from "@vueuse/core";
import type { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import type { ShallowRef, ComputedRef } from "vue";
import { Vector3 } from "three";

// Keys that should have their default browser behavior prevented
const PREVENT_DEFAULT_KEYS = new Set([
  "ArrowUp", // Prevents page scroll
  "ArrowDown", // Prevents page scroll
  "ArrowLeft", // Prevents page scroll
  "ArrowRight", // Prevents page scroll
]);

interface UseKeyboardMovementOptions {
  normalSpeed?: number;
  boostSpeed?: number;
  turnSpeed?: number;
  minHeight?: number;
  onMovement?: () => void;
}

// Helper to safely get a key ref with fallback
const getKeyRef = (
  keys: Record<string, ComputedRef<boolean>>,
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
    turnSpeed = 2.0, // radians per second
    minHeight = 0.3,
    onMovement,
  } = options;

  const keys = useMagicKeys();

  // Movement keys with safe fallbacks
  const keyMap = keys as unknown as Record<string, ComputedRef<boolean>>;
  const forward = getKeyRef(keyMap, "w");
  const backward = getKeyRef(keyMap, "s");
  const left = getKeyRef(keyMap, "a");
  const right = getKeyRef(keyMap, "d");
  const up = getKeyRef(keyMap, "arrowup");
  const down = getKeyRef(keyMap, "arrowdown");
  const turnLeft = getKeyRef(keyMap, "arrowleft");
  const turnRight = getKeyRef(keyMap, "arrowright");
  const boost = getKeyRef(keyMap, "control");

  // Prevent default browser behavior for movement keys (e.g., Space scrolling)
  useEventListener(window, "keydown", (event: KeyboardEvent) => {
    if (PREVENT_DEFAULT_KEYS.has(event.key)) {
      event.preventDefault();
    }
  });

  // Track if any movement key is pressed
  const isMoving = computed(
    () =>
      forward.value ||
      backward.value ||
      left.value ||
      right.value ||
      up.value ||
      down.value ||
      turnLeft.value ||
      turnRight.value,
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

    // Vertical movement and turning
    const camObj = ctl.object;
    if (camObj) {
      if (up.value) camObj.position.y += distance;
      if (down.value) camObj.position.y -= distance;

      // Clamp to minimum height
      camObj.position.y = Math.max(minHeight, camObj.position.y);

      // Turn left/right (rotate around world Y axis)
      const turnAmount = turnSpeed * deltaTime;
      const yAxis = new Vector3(0, 1, 0);
      if (turnLeft.value) camObj.rotateOnWorldAxis(yAxis, turnAmount);
      if (turnRight.value) camObj.rotateOnWorldAxis(yAxis, -turnAmount);
    }
  };

  return {
    isMoving,
    update,
  };
}
