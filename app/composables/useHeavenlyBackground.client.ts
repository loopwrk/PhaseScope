import * as THREE from 'three';

const vertexShader = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Heavenly cloudscape — luminous, iridescent, immersive.
// Designed to feel like travelling through sacred clouds at altitude:
// billowing cumulus forms, divine light source, aurora-like pillars,
// and a six-way iridescent palette cycling through blush → lavender → teal → peach.
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

  // 5-octave FBM — rich, voluminous cloud architecture
  float fbm5(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.0 + vec3(2.1, 8.3, 5.7);
      a *= 0.52;
    }
    return v;
  }

  // 3-octave FBM — lighter warp and wisp passes
  float fbm3(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.3 + vec3(1.7, 9.2, 7.4);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float t = uTime * 0.04;

    // ── SKY BASE ────────────────────────────────────────────────────────────
    // Bright luminous atmosphere: cerulean zenith → soft lavender → warm blush
    float elev   = dir.y;
    vec3 skyTop  = vec3(0.38, 0.60, 0.90);
    vec3 skyMid  = vec3(0.68, 0.72, 0.96); // periwinkle-blue mid sky
    vec3 skyHori = vec3(0.95, 0.80, 0.88);
    vec3 sky = mix(skyHori, skyMid, smoothstep(-0.4, 0.15, elev));
    sky = mix(sky, skyTop, smoothstep(0.0, 0.65, elev));

    // ── DIVINE LIGHT SOURCE ─────────────────────────────────────────────────
    // A heavenly focal point: tight golden corona surrounded by a warm ambient halo.
    // Placed slightly above and ahead — the sacred destination pulling you through.
    vec3 lightDir  = normalize(vec3(0.15, 0.40, 0.90));
    float lDot     = max(0.0, dot(dir, lightDir));
    float corona   = pow(lDot, 14.0);
    float warmHalo = pow(lDot,  3.0) * 0.5;
    vec3 divineHue = vec3(1.00, 0.94, 0.82); // golden-white
    sky += divineHue * (corona * 1.6 + warmHalo);

    // ── LARGE CUMULUS CLOUDS ────────────────────────────────────────────────
    // Two-pass domain warp sculpts soft organic billowing shapes.
    // z-axis drift in sampling space gives the sensation of flying forward.
    vec3 p1   = dir * 2.2 + vec3(t * 0.12, t * 0.06, t * 0.25);
    float w1  = fbm3(p1);
    float cloud1 = fbm5(p1 + w1 * 1.8 + vec3(0.7, 1.9, 0.3));

    float cumulusEdge = smoothstep(0.22, 0.60, cloud1); // soft outer halo
    float cumulusFill = smoothstep(0.36, 0.64, cloud1); // main body
    float cumulusPeak = smoothstep(0.54, 0.72, cloud1); // luminous peaks

    // ── WISPY HIGH-ALTITUDE LAYER ───────────────────────────────────────────
    // Faster, finer-scale — streaks past the cumulus to sell depth and forward motion.
    vec3 p2    = dir * 4.5 + vec3(t * 0.32, t * 0.18, t * 0.44);
    float w2   = fbm3(p2 + vec3(4.1, 2.7, 6.3));
    float cloud2 = fbm3(p2 + w2 * 1.1);
    float wispy  = smoothstep(0.44, 0.60, cloud2) * 0.55;

    // ── IRIDESCENT PALETTE ──────────────────────────────────────────────────
    // Six hues equally spaced around a sine cycle. The spatial variation on
    // dir.y and dir.x means zenith, horizon, and sides all glow different colours,
    // and the whole palette drifts slowly as time advances.
    float ct = t * 0.15 + dir.y * 0.45 + dir.x * 0.28;
    vec3 c0 = vec3(1.00, 0.97, 0.93); // luminous cream
    vec3 c1 = vec3(0.98, 0.76, 0.88); // blush pink (lifted)
    vec3 c2 = vec3(0.72, 0.74, 0.98); // periwinkle — lavender nudged toward blue
    vec3 c3 = vec3(0.62, 0.88, 1.00); // sky blue (brighter)
    vec3 c4 = vec3(0.50, 0.92, 0.88); // teal-mint (lifted)
    vec3 c5 = vec3(0.99, 0.84, 0.72); // warm peach (lifted)

    float wa = max(0.0, sin(ct));
    float wb = max(0.0, sin(ct + 1.047));
    float wc = max(0.0, sin(ct + 2.094));
    float wd = max(0.0, sin(ct + 3.142));
    float we = max(0.0, sin(ct + 4.189));
    float wf = max(0.0, sin(ct + 5.236));
    float wS = wa + wb + wc + wd + we + wf + 0.001;
    vec3 iriHue = (c0*wa + c1*wb + c2*wc + c3*wd + c4*we + c5*wf) / wS;

    // ── CLOUD SHADING ───────────────────────────────────────────────────────
    // Deep indigo-violet shadows (sacred temple-blue) contrast the luminous peaks.
    // Dense cloud cores self-illuminate — backlit as if divine light presses through.
    vec3 shadowCol  = vec3(0.48, 0.52, 0.78); // lifted periwinkle — no more dark holes
    vec3 cloudColor = mix(shadowCol, iriHue, cumulusFill);
    cloudColor     += iriHue     * cumulusPeak * 0.55; // luminous peak bloom
    cloudColor     += divineHue  * corona * cumulusPeak * 0.9; // divine kiss on peak

    // ── AURORA PILLARS ──────────────────────────────────────────────────────
    // Teal and pink vertical light columns — the mystical temple dimension.
    // Keyed to azimuth angle, time-animated, suppressed where thick cloud fills.
    float azimuth    = atan(dir.z, dir.x);
    float tealMix    = sin(azimuth * 2.0 + t * 0.22) * 0.5 + 0.5;
    float auroraWave = sin(azimuth * 3.0 + t * 0.38) * 0.5 + 0.5;
    float auroraVert = smoothstep(0.0, 0.55, dir.y) * (1.0 - cumulusFill * 0.75);
    float auroraGlow = auroraWave * auroraVert * 0.38;
    vec3 auroraHue   = mix(vec3(0.30, 0.90, 0.80), vec3(0.90, 0.45, 0.78), tealMix);

    // ── COMPOSITE ───────────────────────────────────────────────────────────
    vec3 color = sky;
    color = mix(color, iriHue * 0.8 + sky * 0.2, wispy);       // wispy blends into sky
    color = mix(color, cloudColor, cumulusEdge * 0.93);         // cumulus main body
    color += auroraHue * auroraGlow;                            // aurora pillars
    color += divineHue * corona * (1.0 - cumulusFill) * 0.6;  // light bleeds into clear sky

    // Veil — mix toward a soft pastel white to lift contrast and let the
    // foreground geometry breathe. Hues are preserved; only the range compresses.
    color = mix(vec3(0.93, 0.93, 0.97), color, 0.58);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function useHeavenlyBackground(scene: THREE.Scene) {
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
