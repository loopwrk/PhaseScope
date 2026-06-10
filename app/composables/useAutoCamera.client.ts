import * as THREE from 'three';
import type { Ref } from 'vue';
import type { useThree } from '~/composables/useThree.client';
import type { usePhaseGeometry, TopologyMode } from '~/composables/usePhaseGeometry.client';
import type { useCorridorRenderer } from '~/composables/useCorridorRenderer.client';
import { TOPOLOGIES } from '~/composables/usePhaseGeometry.client';

/* useAutoCamera - the orbit / follow / free camera brain.

   Owns the camera mode and the per-frame auto-camera update: a
   registry-driven Lissajous orbit for centre-orbiting topologies
   (sphere, attractor) and bespoke head-relative orbit/follow paths for
   the corridor. Free mode means "hands off" - pointer lock and WASD own
   the camera (the page wires those side effects to `cameraMode`). */

export type CameraMode = 'free' | 'follow' | 'orbit';

interface UseAutoCameraOptions {
    three: ReturnType<typeof useThree>;
    renderer: ReturnType<typeof useCorridorRenderer>;
    geometry: ReturnType<typeof usePhaseGeometry>;
    topologyMode: Ref<TopologyMode>;
    wavLoaded: Ref<boolean>;
}

export function useAutoCamera(options: UseAutoCameraOptions) {
    const { three, renderer, geometry, topologyMode, wavLoaded } = options;

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

    // Switching topology resets to the default orbit view
    watch(topologyMode, () => {
        applyTopologyCameraDefaults();
    });

    const update = (time: number) => {
        if (cameraMode.value === 'free' || !renderer.hasGeometry() || !geometry.corridorState.value.buffer) return;

        const camObj = three.controls.value?.object;
        if (!camObj) return;

        const galleryY = 1.7; // gallery.position.y
        const lerpFactor = 0.1;
        let targetPos: { x: number; y: number; z: number };
        let lookTarget: THREE.Vector3;

        const orbit = TOPOLOGIES[topologyMode.value].orbit;
        if (orbit) {
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
            const headFrameIndex = geometry.corridorState.value.builtFrames - 1;
            if (headFrameIndex < 0) return;

            const frameCenteringDivisor = 2;
            const headZ =
                (headFrameIndex - geometry.corridorState.value.frameCount / frameCenteringDivisor) *
                geometry.corridorMeta.value.zStep;

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
                    x: Math.cos(horizontalAngle) * orbitRadius * (1 + Math.sin(tiltAngle) * 0.3),
                    y: galleryY + 2 + Math.sin(verticalAngle) * verticalAmplitude,
                    z: headZ + Math.sin(horizontalAngle) * orbitRadius,
                };
            } else {
                // Follow mode: isometric angle behind and above the head
                const offset = {
                    x: 5.0, // to the side
                    y: 4.5, // above
                    z: 7.0, // behind the head
                };

                targetPos = {
                    x: offset.x,
                    y: galleryY + offset.y,
                    z: headZ + offset.z,
                };
            }

            lookTarget = new THREE.Vector3(0, galleryY, headZ);
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
        update,
        toggleCameraMode,
        setCameraMode,
    };
}
