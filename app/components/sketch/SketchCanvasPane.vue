<script setup lang="ts">
/* The visual column: canvas toolbar + dotted well. The surface hosts a
   real canvas the sketch's renderFrame draws into each rAF; on a render
   error the loop stops and the last good frame stays up, per spec. The
   px readout reports the canvas backing size. Corner labels are chrome
   the sketch will be able to set later - static mock values for now. */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import SegmentedControl from '../ds/SegmentedControl.vue';
import IconButton from '../ds/IconButton.vue';
import type { SketchAspect } from '~/utils/sketch/model';
import type { RenderFrame } from '~/utils/sketch/runner';

const aspect = defineModel<SketchAspect>('aspect', { default: 'fit' });
const props = defineProps<{ preferredRatio?: number; renderFrame?: RenderFrame; running?: boolean }>();
const emit = defineEmits<{ capture: [dataUrl: string]; 'render-error': [message: string] }>();

const ASPECTS = [
    { value: 'fit', label: 'Fit' },
    { value: '16:9', label: '16:9' },
    { value: '1:1', label: '1:1' },
    { value: 'free', label: 'Free' },
];

const surface = ref<HTMLDivElement>();
const canvas = ref<HTMLCanvasElement>();
const surfaceSize = ref('— × —');
let observer: ResizeObserver | undefined;

function fitCanvas() {
    if (!canvas.value || !surface.value) return;
    const { width, height } = surface.value.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.value.width = Math.round(width * dpr);
    canvas.value.height = Math.round(height * dpr);
    surfaceSize.value = `${canvas.value.width} × ${canvas.value.height}`;
}

onMounted(() => {
    observer = new ResizeObserver(() => fitCanvas());
    if (surface.value) observer.observe(surface.value);
});
onUnmounted(() => {
    observer?.disconnect();
    cancelAnimationFrame(raf);
});

/* Render loop: runs while a frame function is present and running. */
let raf = 0;
let startedAt = 0;
function loop(nowMs: number) {
    if (!props.renderFrame || !props.running || !canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (!ctx) return;
    try {
        ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
        props.renderFrame(ctx, (nowMs - startedAt) / 1000);
    } catch (error) {
        emit('render-error', error instanceof Error ? error.message : String(error));
        return;
    }
    raf = requestAnimationFrame(loop);
}
watch(
    () => [props.renderFrame, props.running] as const,
    () => {
        cancelAnimationFrame(raf);
        if (props.renderFrame && props.running) {
            startedAt = performance.now();
            raf = requestAnimationFrame(loop);
        }
    }
);

function capture() {
    if (!canvas.value) return;
    emit('capture', canvas.value.toDataURL('image/png'));
}

function fullscreen() {
    void surface.value?.requestFullscreen?.();
}

const surfaceStyle = computed(() => {
    if (aspect.value === 'free') return {};
    const ratio = { fit: 'var(--ratio, 16 / 9)', '16:9': '16 / 9', '1:1': '1 / 1' }[aspect.value];
    return { aspectRatio: ratio };
});
</script>

<template>
    <section class="flex min-w-0 flex-1 flex-col bg-(--surface)">
        <div class="flex items-center gap-3.5 border-b border-(--border) px-4 py-2.5">
            <span
                class="font-mono text-(length:--sketch-font-size-micro) tracking-label-wide text-(--text-muted) uppercase"
            >
                Canvas
            </span>
            <SegmentedControl v-model="aspect" :options="ASPECTS" size="sm" />
            <div class="flex-1" />
            <span class="font-mono text-(length:--sketch-font-size-micro) tracking-label text-(--text-muted)">
                {{ surfaceSize }}
            </span>
            <span class="font-mono text-(length:--sketch-font-size-micro) tracking-label text-(--text-muted)">
                60 FPS
            </span>
            <IconButton
                icon="i-lucide-maximize-2"
                variant="sketch"
                size="xs"
                aria-label="Fullscreen canvas"
                @click="fullscreen"
            />
            <IconButton
                icon="i-lucide-circle-dot"
                variant="sketch"
                size="xs"
                aria-label="Capture frame as PNG"
                @click="capture"
            />
        </div>

        <div class="sketch-grid-dots grid min-h-0 flex-1 place-items-center p-[26px]">
            <div
                ref="surface"
                class="relative w-full max-w-[760px] border border-(--border-strong) bg-(--surface-sunken)"
                :class="aspect === 'free' && 'h-full'"
                :style="{ ...surfaceStyle, '--ratio': preferredRatio ?? 16 / 9 }"
            >
                <canvas ref="canvas" class="absolute inset-0 h-full w-full" />
                <span class="corner-label absolute top-2 left-2.5 flex flex-col gap-0.5">
                    <span class="text-(--text-muted)">RE · K=17</span>
                    <span class="text-(--sketch-accent-ink)">IM · K=17</span>
                </span>
                <span class="corner-label absolute right-2.5 bottom-2 text-(--text-muted)">N = 1024</span>
            </div>
        </div>
    </section>
</template>

<style scoped>
.corner-label {
    font-family: var(--font-mono);
    font-size: var(--sketch-font-size-micro);
    letter-spacing: var(--label-tracking-wide);
}
</style>
