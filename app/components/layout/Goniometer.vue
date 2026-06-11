<script setup lang="ts">
/* Goniometer - the instantaneous phase portrait, PhaseScope's own ancestor
   as a HUD instrument. Draws the current playback window's raw Lissajous
   figure (x = L, y = R, matching the 3D portrait convention) on a small
   phosphor-persistence canvas, with a live stereo-correlation readout:
   +1 mono (the L=R diagonal), 0 decorrelated, -1 anti-phase (the other
   diagonal). The trace uses the spectrum data colours - cyan, swinging to
   magenta when correlation goes negative - per the "data, never chrome"
   rule.

   Controlled + pull-based: the parent passes a `source()` getter and this
   component samples it inside its own rAF loop (capped at ~30fps), so no
   reactive churn and zero contact with the WebGL render path. */

export interface GoniometerSource {
    ch0: Float32Array;
    ch1: Float32Array;
    /** Current playback position in samples */
    index: number;
}

const props = defineProps<{ source: () => GoniometerSource | null }>();

const SIZE = 136; // CSS px, square
const WINDOW = 1024; // samples for the correlation estimate
const TRACE = 256; // line segments drawn per update
const FRAME_MS = 33; // ~30fps cap

const canvasEl = ref<HTMLCanvasElement | null>(null);
const corr = ref<number | null>(null);

const corrLabel = computed(() => {
    if (corr.value === null) return '—.——';
    const v = corr.value;
    return `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}`;
});

let raf: number | null = null;
let last = 0;
let colors = { cyan: '#2fd4e6', magenta: '#ff2d9b', grid: 'rgba(144,151,168,0.18)' };

const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    colors = {
        cyan: cs.getPropertyValue('--scope-cyan').trim() || colors.cyan,
        magenta: cs.getPropertyValue('--scope-magenta').trim() || colors.magenta,
        grid: colors.grid,
    };
};

const draw = (now: number) => {
    raf = requestAnimationFrame(draw);
    if (now - last < FRAME_MS) return;
    last = now;

    const canvas = canvasEl.value;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Phosphor decay: fade the previous trace instead of clearing
    ctx.fillStyle = 'rgba(4, 5, 10, 0.28)'; /* --surface-sunken at decay alpha */
    ctx.fillRect(0, 0, w, h);

    // Graticule: the two diagonals (L = R mono axis, L = -R anti-phase axis)
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
    ctx.stroke();

    const src = props.source();
    if (!src) {
        corr.value = null;
        return;
    }

    const { ch0, ch1, index } = src;
    const start = Math.max(0, Math.min(index - WINDOW / 2, ch0.length - WINDOW));
    if (ch0.length < WINDOW) return;

    // Correlation over the window
    let eL = 0;
    let eR = 0;
    let eLR = 0;
    for (let i = start; i < start + WINDOW; i++) {
        const l = ch0[i] ?? 0;
        const r = ch1[i] ?? 0;
        eL += l * l;
        eR += r * r;
        eLR += l * r;
    }
    corr.value = eL > 1e-9 && eR > 1e-9 ? eLR / Math.sqrt(eL * eR) : null;

    // Trace: x = L, y = R (matching the corridor portrait; y up)
    const half = w / 2;
    const gain = half * 0.92;
    const step = Math.max(1, Math.floor(WINDOW / TRACE));
    ctx.strokeStyle = corr.value !== null && corr.value < 0 ? colors.magenta : colors.cyan;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = start, k = 0; i < start + WINDOW; i += step, k++) {
        const x = half + (ch0[i] ?? 0) * gain;
        const y = half - (ch1[i] ?? 0) * gain;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
};

onMounted(() => {
    const canvas = canvasEl.value;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    readColors();
    raf = requestAnimationFrame(draw);
});

onBeforeUnmount(() => {
    if (raf !== null) cancelAnimationFrame(raf);
});
</script>

<template>
    <aside class="ps-glass flex flex-col gap-2 p-3 [clip-path:var(--clip-chamfer-md)]" aria-label="Goniometer">
        <div class="flex items-baseline justify-between gap-3">
            <p class="ps-label">Phase</p>
            <p
                class="font-mono text-caption font-semibold tracking-label tabular-nums"
                :class="corr !== null && corr < 0 ? 'text-(--scope-magenta)' : 'text-(--scope-cyan)'"
                aria-label="Stereo correlation"
            >
                CORR {{ corrLabel }}
            </p>
        </div>
        <canvas
            ref="canvasEl"
            class="bg-(--surface-sunken) [clip-path:var(--clip-chamfer-sm)]"
            :style="{ width: `${SIZE}px`, height: `${SIZE}px` }"
            role="img"
            aria-label="Instantaneous Lissajous figure of the current audio"
        ></canvas>
    </aside>
</template>
