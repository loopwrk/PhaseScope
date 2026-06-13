import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { analyzeFrequencyBand, analyzeLocalFrequency, freqContentToHz, pitchChromaHue } from '~/utils/audio/analysis';
import type { GoniometerSource } from '~/components/layout/Goniometer.vue';
import type { useThree } from '~/composables/useThree.client';

/* useLissajous3D - the live 3D phase portrait. No time axis: where the
   topologies extrude history through space, this is the instantaneous
   figure, embedded in three dimensions and explorable.

   The third axis is a Takens delay embedding - the canonical way to
   reconstruct a signal's phase space (Takens, 1981):

       x = L(t)        y = R(t)        z = mid(t - tau),  tau ~ 6ms

   Because the phase between a signal and its delayed copy depends on
   frequency, every tone tilts the orbit plane differently - the figure
   precesses of its own accord as the music moves.

   Rendering: the last ~93ms as a Line2 fat-line trail (true screen-space
   thickness - plain THREE.Line ignores linewidth on most GPUs) inside a
   graphite wireframe cube. Settings are useState-backed (survive
   navigation, keys under scope:liss-*):
     dimension   '3d' | '2d' (2d flattens the embedding: z = 0)
     lineWidth   trail thickness in px
     colourMode  'spectrum' (hue = pitch chroma: the full wheel per octave,
                 computed per segment from the frequency local to it) or
                 'custom' (persistent user colour via the picker)
     customColour hex string */

const TRAIL_POINTS = 1024;
const TRAIL_WINDOW = 4096; // samples (~93ms at 44.1k)
const DELAY_SECONDS = 0.006; // Takens delay tau
const CUBE_SIZE = 6;
const SIGNAL_SCALE = 2.6; // full-scale samples stay inside the cube walls
const CENTRE_Y = 1.7; // gallery height, matching the topologies
const C0_HZ = 16.3516; // pitch-chroma reference: hue wraps each octave from C

const CUBE_RGB = 0x343b50; // --border-strong graphite
const WAVE_L_RGB = 0x2fd4e6; // --scope-cyan, matching the HUD waveform's L
const WAVE_R_RGB = 0xff2d9b; // --scope-magenta, its R
const WAVE_POINTS = 256;
const WAVE_GAIN = 2.4; // amplitude scale: full-scale stays inside the cube

export function useLissajous3D(
    three: ReturnType<typeof useThree>,
    source: () => (GoniometerSource & { sr: number }) | null
) {
    // Starts INACTIVE to mirror the page's scope3d ref: if these disagree,
    // the first toggle is a no-change and the watcher never builds the scene
    const active = ref(false);

    // Scope display settings (persisted; bound by ScopeSettingsPanel)
    const dimension = usePersistedState<'3d' | '2d'>('scope:liss-dimension', () => '3d');
    // In-cube waveform overlay: time across the cube's width, amplitude on
    // Y, sitting on the mid-Z plane - head-on in 2D it reads as a classic
    // dual-trace scope behind the figure
    const showWaveform = usePersistedState<boolean>('scope:liss-waveform', () => false);
    const lineWidth = usePersistedState<number>('scope:liss-linewidth', () => 1);
    const colourMode = usePersistedState<'spectrum' | 'average' | 'custom'>('scope:liss-colour-mode', () => 'spectrum');
    const customColour = usePersistedState<string>('scope:liss-custom-colour', () => '#2fd4e6'); // scope-cyan
    // Smoothed spectral balance for the 'average' colour mode
    let avgContent = 0.5;

    let group: THREE.Group | null = null;
    let trail: Line2 | null = null;
    let material: LineMaterial | null = null;
    let waveL: THREE.Line | null = null;
    let waveR: THREE.Line | null = null;
    const wavePosL = new Float32Array(WAVE_POINTS * 3);
    const wavePosR = new Float32Array(WAVE_POINTS * 3);
    const positions = new Float32Array(TRAIL_POINTS * 3);
    const colors = new Float32Array(TRAIL_POINTS * 3);
    const colourScratch = new THREE.Color();

    const create = () => {
        group = markRaw(new THREE.Group());
        group.position.set(0, CENTRE_Y, 0);

        // Graphite wireframe cube
        const edges = markRaw(new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)));
        const frame = markRaw(
            new THREE.LineSegments(
                edges,
                markRaw(new THREE.LineBasicMaterial({ color: CUBE_RGB, transparent: true, opacity: 0.55 }))
            )
        );
        group.add(frame);

        material = markRaw(
            new LineMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.95,
                linewidth: lineWidth.value,
            })
        );
        const geometry = markRaw(new LineGeometry());
        geometry.setPositions(positions);
        geometry.setColors(colors);
        trail = markRaw(new Line2(geometry, material));
        trail.frustumCulled = false;
        group.add(trail);

        // The waveform pair: plain thin lines, deliberately quieter than
        // the fat trail so they read as the figure's ruled paper
        const makeWave = (positions: Float32Array, rgb: number) => {
            const g = markRaw(new THREE.BufferGeometry());
            g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const line = markRaw(
                new THREE.Line(
                    g,
                    markRaw(new THREE.LineBasicMaterial({ color: rgb, transparent: true, opacity: 0.65 }))
                )
            );
            line.frustumCulled = false;
            line.visible = showWaveform.value;
            group!.add(line);
            return line;
        };
        waveL = makeWave(wavePosL, WAVE_L_RGB);
        waveR = makeWave(wavePosR, WAVE_R_RGB);

        scene().add(group);
    };

    const scene = () => three.scene;

    const destroy = () => {
        if (!group) return;
        scene().remove(group);
        group.traverse((obj) => {
            const o = obj as THREE.Line;
            o.geometry?.dispose();
            (o.material as THREE.Material)?.dispose?.();
        });
        group = null;
        trail = null;
        material = null;
        waveL = null;
        waveR = null;
    };

    watch(active, (val) => {
        if (val) create();
        else destroy();
    });

    /** Rebuild the trail from the window ending at the playhead. */
    const update = () => {
        if (!group || !trail || !material) return;
        const src = source();
        if (!src) return;

        const { ch0, ch1, index, sr } = src;
        const tau = Math.round(sr * DELAY_SECONDS);
        const start = Math.max(tau, Math.min(index - TRAIL_WINDOW, ch0.length - TRAIL_WINDOW));
        if (ch0.length < TRAIL_WINDOW + tau) return;

        const flat = dimension.value === '2d';
        const spectrum = colourMode.value === 'spectrum';
        if (colourMode.value === 'custom') colourScratch.set(customColour.value);
        if (colourMode.value === 'average') {
            // One colour for the whole figure, from the window's average
            // spectral balance (the same derivative-energy measure as the
            // corridor): bass lands red, treble violet. Smoothed so the
            // figure glides between colours instead of flickering.
            const content =
                (analyzeFrequencyBand(ch0, start, TRAIL_WINDOW) + analyzeFrequencyBand(ch1, start, TRAIL_WINDOW)) / 2;
            avgContent += (content - avgContent) * 0.15;
            colourScratch.setHSL(0.83 * avgContent, 0.9, 0.62);
        }

        const stride = TRAIL_WINDOW / TRAIL_POINTS;
        const gain = SIGNAL_SCALE;
        for (let k = 0; k < TRAIL_POINTS; k++) {
            const i = start + Math.floor(k * stride);
            const L = ch0[i] ?? 0;
            const R = ch1[i] ?? 0;
            const midDelayed = ((ch0[i - tau] ?? 0) + (ch1[i - tau] ?? 0)) * 0.5;
            positions[k * 3] = L * gain;
            positions[k * 3 + 1] = R * gain;
            positions[k * 3 + 2] = flat ? 0 : midDelayed * gain;

            // Head bright, tail embers
            const ramp = 0.12 + 0.88 * (k / (TRAIL_POINTS - 1)) ** 2;
            if (spectrum) {
                // Pitch chroma: hue is the fractional octave position, so the
                // full ROYGBIV wheel cycles once per octave and each part of
                // the figure takes the colour of the frequency local to it
                const hz = freqContentToHz(analyzeLocalFrequency(ch0, ch1, i));
                colourScratch.setHSL(pitchChromaHue(hz, C0_HZ), 0.9, 0.62);
            }
            colors[k * 3] = colourScratch.r * ramp;
            colors[k * 3 + 1] = colourScratch.g * ramp;
            colors[k * 3 + 2] = colourScratch.b * ramp;
        }

        trail.geometry.setPositions(positions);
        trail.geometry.setColors(colors);

        // Waveform overlay: same window, anchored by a rising zero-crossing
        // of the mid signal so periodic notes stand still
        if (waveL && waveR) {
            waveL.visible = showWaveform.value;
            waveR.visible = showWaveform.value;
            if (showWaveform.value) {
                let from = start;
                let prev = (ch0[start] ?? 0) + (ch1[start] ?? 0);
                for (let i = start + 1; i < start + TRAIL_WINDOW / 2; i++) {
                    const m = (ch0[i] ?? 0) + (ch1[i] ?? 0);
                    if (prev <= 0 && m > 0) {
                        from = i;
                        break;
                    }
                    prev = m;
                }
                const span = TRAIL_WINDOW / 2;
                const waveStride = span / WAVE_POINTS;
                const halfW = (CUBE_SIZE / 2) * 0.95;
                for (let k = 0; k < WAVE_POINTS; k++) {
                    const i = from + Math.floor(k * waveStride);
                    const x = -halfW + (k / (WAVE_POINTS - 1)) * halfW * 2;
                    wavePosL[k * 3] = x;
                    wavePosL[k * 3 + 1] = (ch0[i] ?? 0) * WAVE_GAIN;
                    wavePosL[k * 3 + 2] = 0;
                    wavePosR[k * 3] = x;
                    wavePosR[k * 3 + 1] = (ch1[i] ?? 0) * WAVE_GAIN;
                    wavePosR[k * 3 + 2] = 0;
                }
                waveL.geometry.attributes.position!.needsUpdate = true;
                waveR.geometry.attributes.position!.needsUpdate = true;
            }
        }

        // LineMaterial needs the viewport for screen-space widths
        material.linewidth = lineWidth.value;
        const r = three.renderer.value;
        if (r) {
            const size = r.getSize(new THREE.Vector2());
            material.resolution.set(size.x, size.y);
        }
    };

    const dispose = () => destroy();

    return { active, dimension, showWaveform, lineWidth, colourMode, customColour, update, dispose };
}
