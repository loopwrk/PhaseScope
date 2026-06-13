<script setup lang="ts">
/* Waveform: x = time, y = amplitude. Where the
   phase portrait shows the channels' relationship, this shows their
   forms - left in scope-cyan, right in scope-magenta, overlaid on one
   axis (data colours, never chrome).

   A rising zero-crossing trigger anchors each frame's trace.
   The readout is window RMS in dB - level, the natural companion to the
   goniometer's correlation - and warns in magenta near clipping.

   Controlled + pull-based, same contract as the goniometer: the parent
   passes a `source()` getter, sampled in a private rAF at ~30fps. */
import type { GoniometerSource } from '~/components/layout/Goniometer.vue';

const props = defineProps<{ source: () => GoniometerSource | null }>();

const SIZE = 160; // CSS px, square - matches the goniometer's frame
const WINDOW = 2048; // samples fetched per frame
const SPAN = 1024; // samples actually drawn (post-trigger), ~23ms at 44.1k
const TRACE = 320; // line segments per channel
const FRAME_MS = 33; // ~30fps cap

const canvasEl = ref<HTMLCanvasElement | null>(null);
const rmsDb = ref<number | null>(null);
const hot = ref(false); // peak within ~0.1dB of full scale

const rmsLabel = computed(() => {
    if (rmsDb.value === null) return '−∞ dB';
    return `${rmsDb.value.toFixed(1)} dB`;
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

/** First rising zero-crossing of the mid signal within the window's
 *  first half - the oscilloscope trigger that holds the trace still. */
const findTrigger = (ch0: Float32Array, ch1: Float32Array, start: number) => {
    const limit = start + WINDOW - SPAN;
    let prev = (ch0[start] ?? 0) + (ch1[start] ?? 0);
    for (let i = start + 1; i < limit; i++) {
        const mid = (ch0[i] ?? 0) + (ch1[i] ?? 0);
        if (prev <= 0 && mid > 0) return i;
        prev = mid;
    }
    return start;
};

const drawChannel = (
    ctx: CanvasRenderingContext2D,
    data: Float32Array,
    from: number,
    w: number,
    h: number,
    colour: string
) => {
    const step = SPAN / TRACE;
    const mid = h / 2;
    const gain = mid * 0.92;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let k = 0; k <= TRACE; k++) {
        const x = (k / TRACE) * w;
        const y = mid - (data[from + Math.floor(k * step)] ?? 0) * gain;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
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

    ctx.fillStyle = 'rgb(4, 5, 10)'; /* --surface-sunken; clean redraw */
    ctx.fillRect(0, 0, w, h);

    // Graticule: the zero-amplitude axis
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const src = props.source();
    if (!src || src.ch0.length < WINDOW) {
        rmsDb.value = null;
        hot.value = false;
        return;
    }

    const { ch0, ch1, index } = src;
    const start = Math.max(0, Math.min(index - WINDOW, ch0.length - WINDOW));
    const from = findTrigger(ch0, ch1, start);

    // Level readout: RMS over the drawn span, peak-watch for clipping
    let sum = 0;
    let peak = 0;
    for (let i = from; i < from + SPAN; i++) {
        const l = ch0[i] ?? 0;
        const r = ch1[i] ?? 0;
        sum += l * l + r * r;
        peak = Math.max(peak, Math.abs(l), Math.abs(r));
    }
    const rms = Math.sqrt(sum / (SPAN * 2));
    rmsDb.value = rms > 1e-5 ? 20 * Math.log10(rms) : null;
    hot.value = peak >= 0.99;

    drawChannel(ctx, ch0, from, w, h, colors.cyan);
    drawChannel(ctx, ch1, from, w, h, colors.magenta);
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
    <div class="ps-glass flex w-[184px] flex-col gap-2 p-3 text-left [clip-path:var(--clip-chamfer-md)]">
        <div class="flex w-full items-center justify-between gap-3">
            <p class="ps-label">Wave</p>
            <p
                class="whitespace-nowrap font-mono text-caption font-semibold tracking-label tabular-nums"
                :class="hot ? 'text-(--scope-magenta)' : 'text-(--scope-cyan)'"
                aria-label="Signal level (RMS)"
            >
                RMS {{ rmsLabel }}
            </p>
        </div>
        <canvas
            ref="canvasEl"
            class="block bg-(--surface-sunken) [clip-path:var(--clip-chamfer-sm)]"
            :style="{ width: `${SIZE}px`, height: `${SIZE}px` }"
            role="img"
            aria-label="Waveform of the current audio: time against amplitude"
        ></canvas>
        <!-- Channel legend: fills the same footer slot as the goniometer's
             scope button, so the two frames stand at equal height -->
        <div
            class="flex w-full items-center justify-center gap-3 border-t border-(--border) pt-2 font-mono text-caption uppercase tracking-label"
        >
            <span class="text-(--scope-cyan)">— L</span>
            <span class="text-(--scope-magenta)">— R</span>
        </div>
    </div>
</template>
