import * as THREE from 'three';

/* Skybox background factory.

   Both animated GLSL backgrounds (Dream, Heavenly) are the same construct:
   a camera-tracking inverted sphere with a time-driven ShaderMaterial,
   toggled by an `enabled` ref. Only the fragment shader differs, so each
   background module supplies its shader and delegates everything else here.

   Adding a background = one new file with a fragment shader +
   `createSkyboxBackground(scene, fragmentShader)`. */

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* Shared GLSL: value-noise primitives both fragment shaders build on.
   Prepended to every skybox fragment shader. */
export const skyboxNoiseGlsl = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i),               hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }
`;

export function createSkyboxBackground(
    scene: THREE.Scene,
    fragmentShader: string,
    // An external ref (e.g. from useScopeSettings) lets the toggle survive
    // page navigation; the watch below is immediate so a remount with a
    // preserved `true` recreates the mesh in the fresh scene.
    enabled: Ref<boolean> = ref(false)
) {
    let mesh: THREE.Mesh | null = null;

    const create = () => {
        const geometry = markRaw(new THREE.SphereGeometry(180, 48, 32));
        const material = markRaw(
            new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader,
                uniforms: { uTime: { value: 0 } },
                side: THREE.BackSide,
                depthWrite: false,
                depthTest: false,
            })
        );
        mesh = markRaw(new THREE.Mesh(geometry, material));
        mesh.renderOrder = -100;
        mesh.frustumCulled = false;
        scene.add(mesh);
    };

    const destroy = () => {
        if (!mesh) return;
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.ShaderMaterial).dispose();
        mesh = null;
    };

    const update = (time: number, cameraPosition?: THREE.Vector3) => {
        if (!mesh) return;
        // Track camera so the sphere always surrounds it (avoids far-clip issues)
        if (cameraPosition) mesh.position.copy(cameraPosition);
        (mesh.material as THREE.ShaderMaterial).uniforms.uTime!.value = time;
    };

    watch(
        enabled,
        (val) => {
            if (val) create();
            else destroy();
        },
        { immediate: true }
    );

    const dispose = () => destroy();

    return { enabled, update, dispose };
}
