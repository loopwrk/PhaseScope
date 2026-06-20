# PhaseScope

**See the shape of your music - and fly through it.**

![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt.js) ![Three.js](https://img.shields.io/badge/Three.js-0.182-black?logo=three.js) ![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript) ![Web Audio](https://img.shields.io/badge/Web%20Audio-API-FF5E5B) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

PhaseScope turns any stereo track into a luminous, navigable 3D structure that you can through, built from the sound itself in real time, in your browser.

---

## 🌟 Highlights

- 🎧 **Drop in any audio** - a file or a built-in demo - and watch it become a structure you can explore.
- 🌈 **Coloured by pitch.** A real [FFT](https://en.wikipedia.org/wiki/Fast_Fourier_transform) places every note on the colour wheel, so a melody paints itself.
- 🕹️ **Fly through it.** Orbit, follow, or free-fly on desktop; one-finger drag to rotate and pinch to zoom on mobile.
- 🎹 **Play it live.** Hook up a MIDI keyboard (or use the on-screen keys) and your performance draws the geometry as you go.
- 🔭 **Four ways to wrap sound in space** - a flythrough corridor, a sphere, a Lorenz attractor, or a Möbius band.
- 📈 **A real oscilloscope at heart.** A live goniometer sits in the corner; click it to step inside a full 3D phase scope.
- ⚡ **All real-time, no plugins.** Pure [Three.js](https://threejs.org) + the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), running on the GPU.
- 📱 **Made for touch, too** - it works (and reshapes itself) on a phone.

---

## ℹ️ Overview

PhaseScope reads a stereo track frame by frame and maps the left and right channel amplitudes onto the X and Y axes of each point - a [Lissajous figure](https://en.wikipedia.org/wiki/Lissajous_curve), the same picture an old oscilloscope draws from a stereo signal. It then extrudes that figure through space as the audio plays, so **the geometry you're flying through is literally the shape of the sound**. Points are coloured by their pitch and brightened by their loudness; a real windowed FFT runs once per frame to find where each moment sits tonally.

It started as a goniometer - that little oscilloscope HUD in the corner - and grew into something you can walk around inside. Load a song to _watch_ it, or go live and _play_ it.

### 🛠️ How it works (the short version)

1. **Decode** the audio into left/right channel data held in memory.
2. **Slice** it into overlapping ~46 ms windows - one ring of points per window.
3. **Place** each point: `x = left`, `y = right` (the Lissajous portrait), strung along the Z-axis (corridor) or wrapped into a sphere, attractor, or Möbius band.
4. **Colour** each frame from its spectral centroid - the pitch-chroma walks the full colour wheel once per octave.
5. **Build** progressively in sync with playback, paced to stay smooth, with the heavy lifting (oscillation, colour) done on the GPU.

### Collaboration

Have any ideas for how to extend the project, or have a composition you'd like to add to the demo tracks? Please email me at loopwrk@pm.me.

---

## 🚀 Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server
```

Then open **[http://localhost:3000](http://localhost:3000)** - you'll land on `/phasescope`. Pick a demo or load your own audio, and you're in.

Run the tests with `npm test`.

---

## 🎛️ Using it

- **Topologies** - four ways to wrap the audio in space:

    | Mode          | What it is                                                                                                |
    | ------------- | --------------------------------------------------------------------------------------------------------- |
    | **Corridor**  | Each frame is a ring; frames stack into a tunnel you fly through as the track builds. _(default)_         |
    | **Sphere**    | Frames wrap pole to pole - time becomes latitude.                                                         |
    | **Attractor** | Frames trace a [Lorenz attractor](https://en.wikipedia.org/wiki/Lorenz_system); loudness pulls the chaos. |
    | **Möbius**    | Time loops once around a [half-twisted band](https://en.wikipedia.org/wiki/M%C3%B6bius_strip).            |

- **Oscillation** - points can gently move around their anchors (press `O`). Three flavours: **Expressiveness**, each point rotating around a central anchor at it's local frequency, with the distance from the anchor determined by it's amplitude, **Intensity**, a loudness ripple, and **Frequency** the whole frame sways at its pitch.
- **Camera** - **Orbit**, **Follow**, or **Free** (cycle with `C`). Free mode is full first-person flight: WASD to move, mouse to look. On a phone, just **drag to rotate, pinch to zoom, and double-tap** to hand control back to the auto-camera.
- **Goniometer & 3D scope** - toggle the live phase-portrait HUD with `G`; click the figure to enter the full 3D scope, click again to return.
- **Backgrounds** - two animated GLSL skyboxes, **Dream** and **Heavenly** (or none).
- **Go live** - press **Go Live** and play with a MIDI keyboard or the on-screen keys; the synth's stereo output draws the geometry in real time.

### ⌨️ Keyboard shortcuts

| Key       | Action                               |
| --------- | ------------------------------------ |
| `Enter ↵` | Play / Pause                         |
| `R`       | Render mode (Points ↔ Lines)         |
| `O`       | Toggle oscillation                   |
| `C`       | Cycle camera (Orbit → Follow → Free) |
| `F`       | Toggle fullscreen                    |
| `B`       | Toggle Dream background              |
| `N`       | Toggle Heavenly background           |
| `G`       | Toggle goniometer                    |
| `H`       | Toggle controls overlay              |
| `{` / `}` | Previous / next demo                 |
| `[` / `]` | Slower / faster movement             |

In Free / Follow camera, click the canvas to lock the pointer, then use **WASD** (move), **arrow keys** (rise/turn), **Space / Shift** (up/down), and **mouse or touch** to look around. Hardware media keys are wired up via the [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API).

---

## 🧰 Tech stack

|                  |                                                                                 |
| ---------------- | ------------------------------------------------------------------------------- |
| Framework        | [Nuxt 4](https://nuxt.com)                                                      |
| 3D rendering     | [Three.js](https://threejs.org)                                                 |
| Audio            | [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) |
| UI               | [Nuxt UI](https://ui.nuxt.com) + Tailwind CSS                                   |
| Reactivity utils | [VueUse](https://vueuse.org)                                                    |
| Language         | [TypeScript](https://www.typescriptlang.org)                                    |

---

## 📄 License

[MIT](LICENSE) - do what you like, have fun with it.
