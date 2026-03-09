import * as THREE from 'three';

const vertexShader = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Value noise + domain-warped FBM for soft organic cloud forms
const fragmentShader = /* glsl */`
  uniform float uTime;
  varying vec3 vDir;

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

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(1.7, 9.2, 7.4);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.1 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float t = uTime * 0.035;

    // Domain warp: two layers of fbm displacement create organic drifting forms
    vec3 q = dir * 2.2 + vec3(t * 0.18, t * 0.11, t * 0.07);
    float warp = fbm(q);
    float cloud = fbm(q + vec3(warp * 1.6) + vec3(t * 0.04, 0.0, t * 0.02));

    // Soft threshold — wispy edges, not hard clouds
    float veil = smoothstep(0.18, 0.52, cloud);

    // Temple palette — dusty rose, warm cream, muted sage
    vec3 dustyRose = vec3(0.75, 0.52, 0.56);
    vec3 warmCream  = vec3(0.88, 0.82, 0.73);
    vec3 mutedSage  = vec3(0.54, 0.67, 0.57);

    // Slowly cycle hue between the three tones
    float ct = t * 0.12 + dir.y * 0.4 + dir.x * 0.25;
    float w1 = sin(ct)              * 0.5 + 0.5;
    float w2 = sin(ct + 2.094)      * 0.5 + 0.5;
    float w3 = sin(ct + 4.189)      * 0.5 + 0.5;
    float wSum = w1 + w2 + w3 + 0.001;
    vec3 cloudColor = (dustyRose * w1 + warmCream * w2 + mutedSage * w3) / wSum;

    // Near-black void base with barely-there hint of deep indigo
    vec3 base = vec3(0.005, 0.005, 0.022);

    // Cap wisp brightness so it never competes with foreground geometry
    vec3 color = mix(base, cloudColor * 0.22, veil * 0.9);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function useDreamBackground(scene: THREE.Scene) {
    const enabled = ref(false);
    let mesh: THREE.Mesh | null = null;

    const create = () => {
        const geometry = markRaw(new THREE.SphereGeometry(180, 48, 32));
        const material = markRaw(new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: { uTime: { value: 0 } },
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: false,
        }));
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

    watch(enabled, (val) => {
        if (val) create();
        else destroy();
    });

    const dispose = () => destroy();

    return { enabled, update, dispose };
}
