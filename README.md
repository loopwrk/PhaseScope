# PhaseScope

A real-time 3D audio visualiser that renders stereo audio as explorable phase-space geometry. Load any audio file or preset and explore it in 3D space.

![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt.js) ![Three.js](https://img.shields.io/badge/Three.js-0.182-black?logo=three.js) ![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)

---

## What it does

PhaseScope reads a stereo audio file frame by frame, maps the left and right channel amplitudes to the X and Y axes of each point (a [Lissajous / phase portrait](https://en.wikipedia.org/wiki/Lissajous_curve)), and extrudes the result through 3D space as audio plays. The result is a navigable structure built from the shape of the sound itself.

Points are coloured by spectral content — bass frequencies map to blue/magenta, treble to red — with brightness driven by amplitude.

### Topology modes

Three ways to wrap the audio geometry in space:

| Mode          | Description                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Corridor**  | Each audio frame becomes a ring; frames stack along the Z-axis, forming a tunnel you can fly through as the track builds.                                                              |
| **Sphere**    | Frames wrap from north to south pole. Time becomes latitude.                                                                                                                           |
| **Attractor** | Frames trace a [Lorenz strange attractor](https://en.wikipedia.org/wiki/Lorenz_system); audio amplitude modulates the chaos parameter ρ, pulling the trajectory between the two lobes. |

---

## Getting started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/phasescope`.

---

## Controls

### Keyboard shortcuts

| Key       | Action                                    |
| --------- | ----------------------------------------- |
| `Enter ↵` | Play / Pause                              |
| `R`       | Toggle render mode (Points ↔ Lines)      |
| `O`       | Toggle point oscillation                  |
| `C`       | Cycle camera mode (Orbit → Follow → Free) |
| `F`       | Toggle fullscreen                         |
| `V`       | Reverse colour spectrum                   |
| `B`       | Toggle Dream background                   |
| `N`       | Toggle Heavenly background                |
| `H`       | Toggle controls overlay                   |
| `{` / `}` | Previous / next demo track                |
| `[` / `]` | Decrease / increase movement speed        |

### Navigation (Free / Follow camera)

Click on the canvas to lock the pointer. Then:

- **WASD** — move forward / back / strafe
- **Arrow keys** — move vertically (↑/↓) or turn (←/→)
- **Space** — move up; **Shift** — move down
- **Mouse drag / touch** — look around

Hardware media keys (play, skip) are wired up via the [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API).

---

## Features

### Rendering

- **Points** and **Lines** render modes, toggled live with `R`
- Vertex colours computed per-point from frequency (hue) and amplitude (lightness + saturation)
- Geometry built progressively in sync with playback — up to 6 frames per animation tick to avoid hitches
- Draw range updated each frame so only built frames are rendered

### Oscillation

Points can oscillate around their anchor positions. Three modes available under Advanced Options:

- **Wave** — a ripple propagates backward from the playback head; louder sections create bigger waves
- **Per-frame** — all points in a frame move together at the frame's average frequency; preserves ring shape
- **Per-point** — each point oscillates independently at its locally-estimated frequency

### Camera

- **Orbit** — Lissajous-like path that slowly circles the active geometry; default on load
- **Follow** — isometric angle behind and above the corridor head
- **Free** — full first-person exploration with WASD + pointer lock

Camera smoothly lerps to its target position each frame. Moving with WASD or locking the pointer automatically switches to Free mode.

Two animated GLSL skyboxes rendered on the inside of a large sphere surrounding the camera:

### Performance controls

- **Points per frame** — 32–512, controls ring resolution
- **Track coverage** — 10–100%, sets the point budget as a percentage of the full track
- Warnings shown at 3M and 8M points

---

## Project structure

```
app/
├── pages/
│   ├── phasescope.vue          # Main visualiser (routing root)
│   └── login.vue               # Simple auth page (disabled by default)
├── composables/
│   ├── useThree.client.ts          # Three.js scene, camera, renderer, PointerLock
│   ├── useCorridorRenderer.client.ts # BufferGeometry management for points/lines
│   ├── useWavPlayer.client.ts      # Web Audio API decode + playback with pause/resume
│   ├── useDemoTracks.ts            # Fetches and loads tracks from audio-manifest.json
│   ├── useOscillation.client.ts    # Wave / per-point / per-frame oscillation
│   ├── useDreamBackground.client.ts  # Dark GLSL skybox
│   ├── useHeavenlyBackground.client.ts # Luminous GLSL skybox
│   ├── useKeyboardMovement.client.ts # WASD + arrow key camera movement
│   ├── useKeyboardShortcuts.client.ts # Global shortcut registry
│   ├── usePointerLockCamera.client.ts # Pointer lock for first-person look
│   └── experimental/
│       └── useNarrativeTransform.ts  # Staged geometry morphing
├── utils/
│   └── audio/
│       └── analysis.ts         # Frequency band estimation via derivative energy
└── constants/
    └── music.ts                # Musical note / frequency constants

public/
└── audio/                      # Drop audio files here; manifest is auto-generated
```

---

## Tech stack

|                      |                                                 |
| -------------------- | ----------------------------------------------- |
| Framework            | [Nuxt 4](https://nuxt.com)                      |
| 3D rendering         | [Three.js](https://threejs.org)                 |
| Audio                | Web Audio API                                   |
| UI                   | [Nuxt UI 4](https://ui.nuxt.com) + Tailwind CSS |
| Reactivity utils     | [VueUse](https://vueuse.org)                    |
| Synth (experimental) | [Tone.js](https://tonejs.github.io)             |
| Language             | TypeScript 5                                    |

---

## How the visualisation works

1. **Load** — the audio file is decoded into an `AudioBuffer` via `decodeAudioData`. Left and right channel `Float32Array`s are held in memory.

2. **Frame slicing** — the buffer is divided into overlapping windows (`windowSize = 2048` samples, `hopSize = 1024`). Each window becomes one frame of geometry.

3. **Point placement** — for each of the 32–512 points in a frame:
    - A parametric angle `u` walks around a ring
    - `x = L * xyScale`, `y = R * xyScale` gives the Lissajous portrait
    - In **corridor** mode the ring is centred at `z = (frameIndex - frameCount/2) * zStep`
    - In **sphere** mode `(phi, theta)` map frame index and point index to spherical coordinates
    - In **attractor** mode points are placed on a tube cross-section around a pre-computed Lorenz spine, with Frenet frames computed via parallel transport

4. **Attractor spine** — pre-computed at load time using a 4th-order Runge-Kutta integrator. The RMS envelope of the audio modulates ρ between 25 and 38, pulling the trajectory between the two lobes of the butterfly.

5. **Colour** — frequency content per frame is estimated from the ratio of derivative energy to signal energy (a lightweight proxy for spectral centroid). Hue is mapped across 75% of the colour wheel; lightness and saturation scale with amplitude.

6. **Progressive build** — frames are written into pre-allocated `Float32Array` buffers. Up to 6 frames are built per animation tick, paced to the audio playback position. Only built frames are in the GPU draw range.

---

## License

[MIT](LICENSE)
