import * as THREE from 'three';
import type { Ref } from 'vue';
import type { useThree } from '~/composables/useThree.client';
import type { useAutoCamera, CameraMode } from '~/composables/useAutoCamera.client';
import type { TopologyMode } from '~/utils/topologies';

/* useTouchOrbit - touch-only orbit/zoom for the 3D views (mobile).

   The shared OrbitControls instance lives in useThree; this composable owns its
   dynamics: it arms the controls for touch input only (the mouse keeps the
   desktop fly camera), hands the camera over from the auto-camera on the first
   drag/pinch, keeps the orbit target pinned to whatever the auto-camera was
   centred on (so head-anchored topologies follow the head live), and hands
   control back on a double-tap. Pan is off everywhere - one finger rotates, two
   fingers pinch-zoom.

   Two views are special:
     - 2D scope: rotation stays locked (gaze square-on). OrbitControls is kept
       disabled and a bespoke pinch handler dollies the gaze-locked Z instead.
     - everything else (corridor / sphere / attractor / Möbius / 3D scope):
       full orbit + pinch-zoom around the per-topology centre. */

// Pinch-zoom distance clamps per topology (min, max world units), tuned to the
// auto-camera's framing so a pinch can't invert through the centre or fly off.
const ZOOM_CLAMPS: Record<TopologyMode, [number, number]> = {
    corridor: [2, 20],
    sphere: [5, 30],
    attractor: [6, 40],
    mobius: [5, 30],
    poincare: [5, 30],
    harmonics: [5, 30],
    knot: [5, 30],
    helix: [2, 24], // head-anchored and slim, like the corridor
    hopf: [5, 40], // nested rings can splay wide, like the attractor
};
// The Lissajous cube is small and centred; tighter range than the topologies.
const SCOPE_ZOOM_CLAMP: [number, number] = [3, 20];
// 2D scope dolly range along Z, matching the keyboard dolly's pane clamp.
const SCOPE_2D_MIN_Z = 3.2;
const SCOPE_2D_MAX_Z = 14;

const DOUBLE_TAP_MS = 300;
const TAP_MOVE_PX = 8; // a one-finger move beyond this is a drag, not a tap

interface UseTouchOrbitOptions {
    three: ReturnType<typeof useThree>;
    camera: ReturnType<typeof useAutoCamera>;
    topologyMode: Ref<TopologyMode>;
    /** 3D Lissajous scope active (cube at origin). */
    scopeActive: Ref<boolean>;
    /** 2D scope lock: rotation disabled, pinch dollies the gaze-locked Z. */
    scope2dLocked: Ref<boolean>;
}

export function useTouchOrbit(options: UseTouchOrbitOptions) {
    const { three, camera, topologyMode, scopeActive, scope2dLocked } = options;

    // While true, OrbitControls owns the camera and the auto-camera stands down.
    const touchActive = ref(false);
    // The auto mode to restore on double-tap (captured at takeover).
    let resumeMode: CameraMode = 'orbit';

    // Per-gesture bookkeeping for tap / double-tap / pinch detection.
    let lastTapTime = 0;
    let gestureMoved = false; // a drag or multi-touch happened this gesture
    let engagedThisGesture = false; // this gesture is what flipped us to manual
    let startX = 0;
    let startY = 0;
    let pinchBaseDist = 0; // 2D-scope pinch baseline
    let pinchBaseZ = 0;

    const orbitInstance = () => three.orbitControls.value;

    const applyClamps = () => {
        const orbit = orbitInstance();
        if (!orbit) return;
        const [min, max] = scopeActive.value ? SCOPE_ZOOM_CLAMP : (ZOOM_CLAMPS[topologyMode.value] ?? [2, 40]);
        orbit.minDistance = min;
        orbit.maxDistance = max;
    };

    /** Per-frame: while manual, OrbitControls drives. Returns true when it owns
     *  the camera this frame, so the render loop can skip the auto-camera. */
    const update = (): boolean => {
        const orbit = orbitInstance();
        if (!orbit || !touchActive.value) return false;
        // Track the auto-camera's centre live: head-anchored topologies keep
        // following the head while the user controls angle and distance.
        orbit.target.copy(camera.getOrbitTarget());
        orbit.update();
        return true;
    };

    /** Hand the camera back to the auto path (double-tap, or a context change). */
    const returnToAuto = () => {
        if (!touchActive.value) return;
        touchActive.value = false;
        camera.cameraMode.value = resumeMode;
        camera.resetOrbitClock(); // resume the centre-orbit path cleanly
        const orbit = orbitInstance();
        if (orbit) orbit.enabled = false; // re-armed on the next touch
    };

    // A topology or scope change resets to that context's auto camera; the
    // auto-camera's own watchers set the mode, so we only stand the touch layer
    // down and refresh the zoom clamps.
    const standDown = () => {
        touchActive.value = false;
        const orbit = orbitInstance();
        if (orbit) orbit.enabled = false;
        applyClamps();
    };
    watch([topologyMode, scopeActive], standDown);
    // Entering the 2D lock must kill any live orbit (rotation is forbidden there)
    watch(scope2dLocked, (locked) => {
        if (locked) standDown();
    });

    /* ---------- Input handlers (wired in init) ---------- */

    const onPointerDown = (e: PointerEvent) => {
        if (e.pointerType !== 'touch') return; // the mouse keeps the fly camera
        if (scope2dLocked.value) return; // 2D: the pinch handler owns touch, no orbit
        const orbit = orbitInstance();
        if (orbit) orbit.enabled = true; // arm for this gesture (capture phase, before OrbitControls)
    };

    // OrbitControls fires 'start' on the first armed touch gesture; that is our
    // hand-off from the auto-camera.
    const onOrbitStart = () => {
        const orbit = orbitInstance();
        if (!orbit || !orbit.enabled || touchActive.value) return;
        resumeMode = camera.cameraMode.value; // remember the auto mode
        camera.cameraMode.value = 'free'; // the auto-camera stands down
        touchActive.value = true;
        engagedThisGesture = true;
    };

    const touchDist = (t: TouchList): number => {
        const a = t[0];
        const b = t[1];
        if (!a || !b) return 0;
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
        gestureMoved = e.touches.length >= 2; // multi-touch is never a tap
        engagedThisGesture = false;
        const t = e.touches[0];
        if (t) {
            startX = t.clientX;
            startY = t.clientY;
        }
        if (scope2dLocked.value && e.touches.length === 2) {
            pinchBaseDist = touchDist(e.touches);
            pinchBaseZ = three.camera.value?.position.z ?? 0;
        }
    };

    const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length >= 2) {
            gestureMoved = true;
        } else {
            const t = e.touches[0];
            if (t && Math.hypot(t.clientX - startX, t.clientY - startY) > TAP_MOVE_PX) gestureMoved = true;
        }
        // 2D scope: pinch dollies the gaze-locked Z; rotation stays disabled.
        if (scope2dLocked.value && e.touches.length === 2 && pinchBaseDist > 0) {
            const cam = three.camera.value;
            if (!cam) return;
            const scale = pinchBaseDist / touchDist(e.touches);
            cam.position.z = Math.min(SCOPE_2D_MAX_Z, Math.max(SCOPE_2D_MIN_Z, pinchBaseZ * scale));
        }
    };

    const onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length > 0) return; // wait until every finger lifts
        if (gestureMoved) return; // a drag/pinch, not a tap
        const now = performance.now();
        const isDouble = now - lastTapTime < DOUBLE_TAP_MS;
        lastTapTime = isDouble ? 0 : now;
        if (isDouble) {
            returnToAuto(); // double-tap: back to the auto camera
            return;
        }
        // A lone tap must not freeze the auto camera: undo the provisional
        // hand-off that OrbitControls' 'start' just made on touch-down.
        if (engagedThisGesture && touchActive.value) {
            touchActive.value = false;
            camera.cameraMode.value = resumeMode;
            const orbit = orbitInstance();
            if (orbit) orbit.enabled = false;
        }
    };

    const teardown: (() => void)[] = [];

    /** Wire the touch listeners. Call once after three.init() (so the renderer's
     *  DOM element and the OrbitControls instance exist). */
    const init = () => {
        const dom = three.renderer.value?.domElement;
        const orbit = orbitInstance();
        if (!dom || !orbit) return;

        applyClamps();

        const ac = new AbortController();
        const signal = ac.signal;
        // Capture phase so orbit is armed before OrbitControls' own handler runs.
        dom.addEventListener('pointerdown', onPointerDown, { capture: true, signal });
        dom.addEventListener('touchstart', onTouchStart, { passive: true, signal });
        dom.addEventListener('touchmove', onTouchMove, { passive: true, signal });
        dom.addEventListener('touchend', onTouchEnd, { passive: true, signal });
        dom.addEventListener('touchcancel', onTouchEnd, { passive: true, signal });
        orbit.addEventListener('start', onOrbitStart);

        teardown.push(() => ac.abort());
        teardown.push(() => orbit.removeEventListener('start', onOrbitStart));
    };

    onUnmounted(() => {
        teardown.forEach((fn) => fn());
        teardown.length = 0;
    });

    return {
        touchActive,
        init,
        update,
    };
}
