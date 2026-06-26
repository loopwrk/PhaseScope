import type * as THREE from 'three';
import { createSkyboxBackground, skyboxNoiseGlsl } from './createSkyboxBackground.client';

// Starfield - a deep night sky of layered, twinkling stars over a faint nebula,
// with a soft warm horizon glow (a nod to the synthwave-sunset look). Dark by
// design so the foreground geometry stays the brightest thing on screen.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vDir;

  ${skyboxNoiseGlsl}

  // 4-octave fbm over the shared value noise - a slow, faint deep-space nebula
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.0 + vec3(3.1, 1.7, 5.2);
      a *= 0.5;
    }
    return v;
  }

  // One layer of jittered point-stars, returning the star's colour * brightness.
  // 'scale' sets the cell density, 'sparsity' the fraction of empty cells (higher
  // -> fewer stars), 'seed' offsets the grid so layers don't align. Each star is
  // a crisp pinpoint with only a faint sparkle, twinkling at its own rate, and
  // tinted per star: mostly blue, some white, a few red dotted around.
  vec3 starLayer(vec3 dir, float scale, float sparsity, float seed, float t) {
    vec3 p = dir * scale + seed;
    vec3 cell = floor(p);
    vec3 f = fract(p);
    float present = step(sparsity, hash(cell));
    // jitter the star within its cell, kept off the edges to avoid clipping
    vec3 jitter = 0.2 + 0.6 * vec3(hash(cell + 11.0), hash(cell + 23.0), hash(cell + 37.0));
    float d = length(f - jitter);
    float size = 0.7 + 0.9 * hash(cell + 17.0);
    float r = 0.085 * size;
    float core = 1.0 - smoothstep(r * 0.4, r, d); // solid bright disc, crisp edge
    float halo = pow(max(0.0, 1.0 - d * 2.6), 6.0) * 0.22; // modest, tight bloom
    float tw = 0.7 + 0.3 * sin(t * (0.8 + 2.0 * hash(cell + 5.0)) + hash(cell) * 6.2831);
    float bright = present * (core + halo) * tw;

    // per-star colour class: mostly blue, some white, a rare few red
    float ch = hash(cell + 7.0);
    vec3 col = vec3(0.92, 0.96, 1.0); // white (default)
    col = mix(col, vec3(0.50, 0.70, 1.0), step(0.25, ch)); // blue (the majority)
    col = mix(col, vec3(1.0, 0.36, 0.30), step(0.92, ch)); // red (a rare few)
    return col * bright;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float t = uTime;

    // -- deep night-sky gradient: darkest toward the poles, a hint of warmth at the horizon --
    float elev = abs(dir.y);
    vec3 zenith  = vec3(0.012, 0.016, 0.05); // deep indigo void
    vec3 midSky  = vec3(0.025, 0.035, 0.10); // navy
    vec3 horizon = vec3(0.06, 0.035, 0.09);  // faint warm purple band
    vec3 sky = mix(horizon, midSky, smoothstep(0.0, 0.30, elev));
    sky = mix(sky, zenith, smoothstep(0.22, 0.85, elev));

    // soft warm horizon glow, all the way around (the synthwave sunset)
    float warm = smoothstep(0.20, 0.0, abs(dir.y));
    sky += vec3(0.10, 0.03, 0.05) * warm;

    // -- faint nebula: slow deep-blue / violet colour clouds for depth --
    float neb = fbm(dir * 1.7 + vec3(t * 0.008, 0.0, t * 0.005));
    neb = smoothstep(0.5, 0.85, neb);
    vec3 nebCol = mix(vec3(0.05, 0.02, 0.12), vec3(0.02, 0.07, 0.12), dir.y * 0.5 + 0.5);
    sky += nebCol * neb * 0.6;

    // -- stars: three layers for parallax depth (faint+dense -> sparse+bright) --
    vec3 starCol = vec3(0.0);
    starCol += starLayer(dir, 90.0, 0.82, 0.0, t) * 1.0;
    starCol += starLayer(dir, 48.0, 0.87, 50.0, t) * 1.5;
    starCol += starLayer(dir, 24.0, 0.90, 90.0, t) * 2.1;

    vec3 color = sky + starCol;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function useStarfieldBackground(scene: THREE.Scene, enabled?: Ref<boolean>) {
    return createSkyboxBackground(scene, fragmentShader, enabled);
}
