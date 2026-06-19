import * as THREE from 'three';
import type { ComputedRef, Ref } from 'vue';
import type { useThree } from '~/composables/useThree.client';
import type { usePhaseGeometry } from '~/composables/usePhaseGeometry.client';
import type { useCorridorRenderer } from '~/composables/useCorridorRenderer.client';
import { TOPOLOGIES, type TopologyMode } from '~/utils/topologies';

/* useAutoCamera - the orbit / follow / free camera brain.

   Owns the camera mode and the per-frame auto-camera update: a
   registry-driven Lissajous orbit for centre-orbiting topologies
   (sphere, attractor) and bespoke head-relative orbit/follow paths for
   the corridor. Free mode means "hands off" - pointer lock and WASD own
   the camera (the page wires those side effects to `cameraMode`). */

export type CameraMode = 'free' | 'follow' | 'orbit';

// Orbit for the 3D Lissajous scope: a tighter circle around the cube
const LISSAJOUS_ORBIT = {
    radius: 9,
    speed: 0.18,
    elevCosFreq: 0.14,
    elevCosAmp: 0.8,
    elevSinFreq: 0.37,
    elevSinAmp: 0.3,
    wobbleFreq: 0.45,
    wobbleAmp: 1.2,
};

interface UseAutoCameraOptions {
    three: ReturnType<typeof useThree>;
    renderer: ReturnType<typeof useCorridorRenderer>;
    geometry: ReturnType<typeof usePhaseGeometry>;
    topologyMode: Ref<TopologyMode>;
    wavLoaded: Ref<boolean> | ComputedRef<boolean>;
    /** While the 3D Lissajous scope is active, orbit its cube instead */
    lissajousActive?: Ref<boolean>;
    /** In the scope's 2D mode, lock straight-on to the cube's front face */
    lissajousDimension?: Ref<'3d' | '2d'>;
}

export function useAutoCamera(options: UseAutoCameraOptions) {
    const { three, renderer, geometry, topologyMode, wavLoaded, lissajousActive, lissajousDimension } = options;

    const cameraMode = ref<CameraMode>('orbit');

    // Epoch for the centre-orbit clock; reset when a track loads so the
    // orbit starts from the top of its path.
    const orbitStartTime = ref(0);
    const resetOrbitClock = () => {
        orbitStartTime.value = performance.now() / 1000;
    };

    const applyTopologyCameraDefaults = () => {
        cameraMode.value = 'orbit';
    };

    // Live sessions open in Follow (the corridor head leads, the player watches
    // their performance build ahead of them); track playback stays in Orbit.
    const applyLiveCameraDefaults = () => {
        cameraMode.value = 'follow';
    };

    // Switching topology resets to the default orbit view
    watch(topologyMode, () => {
        applyTopologyCameraDefaults();
    });

    // The scope's 2D view is a LOCK: if the user was flying free, hand the
    // camera back to the auto path so the front-face hold actually engages
    if (lissajousActive && lissajousDimension) {
        watch([lissajousActive, lissajousDimension], ([active, dim]) => {
            if (active && dim === '2d') {
                cameraMode.value = 'orbit';
                if (document.pointerLockElement) document.exitPointerLock();
            }
        });
    }

    const update = (time: number) => {
        const state = geometry.corridorState.value;
        if (cameraMode.value === 'free' || !renderer.hasGeometry() || (!state.buffer && !state.live)) return;

        const camObj = three.controls.value?.object;
        if (!camObj) return;

        const galleryY = 1.7; // gallery.position.y
        const lerpFactor = 0.1;
        let targetPos: { x: number; y: number; z: number };
        let lookTarget: THREE.Vector3;

        if (lissajousActive?.value && lissajousDimension?.value === '2d') {
            // 2D scope: hold square-on to the front face (x/y centred, gaze
            // locked); Z belongs to the W/S dolly, clamped at the pane
            targetPos = { x: 0, y: galleryY, z: Math.min(14, Math.max(3.2, camObj.position.z)) };
            lookTarget = new THREE.Vector3(0, galleryY, 0);
        } else if (lissajousActive?.value || TOPOLOGIES[topologyMode.value].orbit) {
            const orbit = lissajousActive?.value ? LISSAJOUS_ORBIT : TOPOLOGIES[topologyMode.value].orbit!;
            // Centre-orbiting topologies (sphere, attractor): a Lissajous-like
            // path around the origin whose constants come from the registry.
            // Elevation starts at the top (cos term = 1) and naturally drifts
            // down; the second sine term varies the path so it never repeats,
            // and the radius wobble keeps the viewing distance alive.
            const t = (time - orbitStartTime.value) * orbit.speed;
            const horizontalAngle = t;
            const elevationAngle =
                Math.cos(t * orbit.elevCosFreq) * orbit.elevCosAmp + Math.sin(t * orbit.elevSinFreq) * orbit.elevSinAmp;
            const r = orbit.radius + Math.sin(t * orbit.wobbleFreq) * orbit.wobbleAmp;

            targetPos = {
                x: Math.cos(horizontalAngle) * Math.cos(elevationAngle) * r,
                y: galleryY + Math.sin(elevationAngle) * r,
                z: Math.sin(horizontalAngle) * Math.cos(elevationAngle) * r,
            };

            lookTarget = new THREE.Vector3(0, galleryY, 0);
        } else {
            // Corridor mode
            const headFrameIndex = geometry.headFrameIndex();
            if (headFrameIndex < 0) return;

            // Where the head ACTUALLY is: channel bias crushes the
            // corridor's z, so ask the engine rather than assuming.
            const head = geometry.transformHeadAnchor(headFrameIndex);

            if (cameraMode.value === 'orbit') {
                // Drone-like orbit around the corridor head
                // Uses Lissajous-like path
                const orbitRadius = 8.0;
                const verticalAmplitude = 3.0;
                const orbitSpeed = 0.15; // Slow rotation

                // Different frequencies for each axis create figure-8 like patterns
                const horizontalAngle = time * orbitSpeed;
                const verticalAngle = time * orbitSpeed * 0.7; // Slower vertical oscillation
                const tiltAngle = time * orbitSpeed * 0.3; // Even slower tilt

                // Orbit in XZ plane around the head, with Y oscillation
                targetPos = {
                    x: head.x + Math.cos(horizontalAngle) * orbitRadius * (1 + Math.sin(tiltAngle) * 0.3),
                    y: galleryY + head.y + 2 + Math.sin(verticalAngle) * verticalAmplitude,
                    z: head.z + Math.sin(horizontalAngle) * orbitRadius,
                };
            } else {
                // Follow mode: isometric angle behind and above the head
                const offset = {
                    x: 5.0, // to the side
                    y: 4.5, // above
                    z: 7.0, // behind the head
                };

                targetPos = {
                    x: head.x + offset.x,
                    y: galleryY + head.y + offset.y,
                    z: head.z + offset.z,
                };
            }

            lookTarget = new THREE.Vector3(head.x, galleryY + head.y, head.z);
        }

        // Smooth camera movement
        camObj.position.x += (targetPos.x - camObj.position.x) * lerpFactor;
        camObj.position.y += (targetPos.y - camObj.position.y) * lerpFactor;
        camObj.position.z += (targetPos.z - camObj.position.z) * lerpFactor;

        // Look at the target
        three.camera.value?.lookAt(lookTarget);
    };

    // Cycle through camera modes: free -> follow -> orbit -> free
    const toggleCameraMode = () => {
        // Only allow toggling if WAV is loaded
        if (!wavLoaded.value) return;

        const modes: CameraMode[] = ['free', 'follow', 'orbit'];
        const currentIndex = modes.indexOf(cameraMode.value);
        const nextIndex = (currentIndex + 1) % modes.length;
        cameraMode.value = modes[nextIndex] ?? 'free';

        // Exit pointer lock when entering follow/orbit mode so camera can move smoothly
        if (cameraMode.value !== 'free' && document.pointerLockElement) {
            document.exitPointerLock();
        }
    };

    // Set a camera mode directly (from the controls overlay). Mirrors the
    // pointer-lock side effect of the cycle handler.
    const setCameraMode = (mode: CameraMode) => {
        if (!wavLoaded.value) return;
        cameraMode.value = mode;
        if (mode !== 'free' && document.pointerLockElement) {
            document.exitPointerLock();
        }
    };

    return {
        cameraMode,
        resetOrbitClock,
        applyTopologyCameraDefaults,
        applyLiveCameraDefaults,
        update,
        toggleCameraMode,
        setCameraMode,
    };
}
