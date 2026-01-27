import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

export function useThree(canvasContainer: Ref<HTMLDivElement | null>) {
  if (import.meta.server) {
    const scene = markRaw(new THREE.Scene());
    return {
      scene,
      camera: shallowRef<THREE.PerspectiveCamera | null>(null),
      renderer: shallowRef<THREE.WebGLRenderer | null>(null),
      controls: shallowRef<PointerLockControls | null>(null),
      isFullscreen: ref(false),
      init: () => {},
      dispose: () => {},
      updateRendererSize: () => {},
      toggleFullscreen: async () => {},
    };
  }

  const scene = markRaw(new THREE.Scene());
  const camera = shallowRef<THREE.PerspectiveCamera | null>(null);
  const renderer = shallowRef<THREE.WebGLRenderer | null>(null);
  const controls = shallowRef<PointerLockControls | null>(null);
  const ground = shallowRef<THREE.Mesh | null>(null);
  const isFullscreen = ref(false);

  const updateRendererSize = () => {
    const r = renderer.value;
    const c = camera.value;
    if (!canvasContainer.value || !r || !c) return;

    const width = canvasContainer.value.clientWidth;
    const height = canvasContainer.value.clientHeight;

    r.setSize(width, height);
    c.aspect = width / height;
    c.updateProjectionMatrix();
  };

  const onFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement;
    updateRendererSize();
  };

  const toggleFullscreen = async () => {
    if (!canvasContainer.value) return;

    try {
      if (!document.fullscreenElement) {
        await canvasContainer.value.requestFullscreen();
        isFullscreen.value = true;
      } else {
        await document.exitFullscreen();
        isFullscreen.value = false;
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  const init = () => {
    // Camera
    const cameraFOV = 70;
    const nearClip = 0.01;
    const farClip = 200;

    const c = markRaw(
      new THREE.PerspectiveCamera(cameraFOV, 1, nearClip, farClip)
    );
    c.position.set(0, 1.6, 6);
    camera.value = c;

    // Renderer
    const r = markRaw(new THREE.WebGLRenderer({ antialias: true }));
    renderer.value = r;

    if (canvasContainer.value) {
      canvasContainer.value.appendChild(r.domElement);
      r.domElement.style.borderRadius = "0.5rem";
      updateRendererSize();
    }

    // Lights
    const ambient = markRaw(new THREE.AmbientLight(0xffffff, 0.35));
    scene.add(ambient);

    const point = markRaw(new THREE.PointLight(0xffffff, 0.9));
    point.position.set(3, 6, 4);
    scene.add(point);

    // Ground
    const g = markRaw(
      new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({
          color: 0x050505,
          roughness: 1,
          metalness: 0,
        })
      )
    );
    g.rotation.x = -Math.PI / 2;
    g.position.y = 0;
    scene.add(g);
    ground.value = g;

    // Controls
    const ctl = markRaw(new PointerLockControls(c, r.domElement));
    controls.value = ctl;
    // PointerLockControls exposes the camera via the 'object' property
    scene.add(ctl.object);

    // Fog (obscures head and tail)
    scene.fog = markRaw(new THREE.Fog(0x000000, 200, 200));

    // Events
    window.addEventListener("resize", updateRendererSize);
    document.addEventListener("fullscreenchange", onFullscreenChange);
  };

  const dispose = () => {
    window.removeEventListener("resize", updateRendererSize);
    document.removeEventListener("fullscreenchange", onFullscreenChange);

    if (controls.value) {
      scene.remove(controls.value.object);
    }

    if (ground.value) {
      scene.remove(ground.value);
      ground.value.geometry.dispose();
      const mat = ground.value.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
      ground.value = null;
    }

    if (renderer.value) {
      const el = renderer.value.domElement;
      renderer.value.dispose();
      if (el && el.parentElement) el.parentElement.removeChild(el);
      renderer.value = null;
    }

    camera.value = null;
    controls.value = null;
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    isFullscreen,
    init,
    dispose,
    updateRendererSize,
    toggleFullscreen,
  };
}
