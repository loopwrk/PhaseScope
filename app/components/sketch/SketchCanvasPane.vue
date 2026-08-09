<script setup lang="ts">
/* The visual column: canvas toolbar + dotted well. The surface is the
   placeholder the runner will draw into; corner labels are chrome the
   sketch can set later, so they take static mock values for now. The
   px readout reports the surface's real size. */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import SegmentedControl from '../ds/SegmentedControl.vue';
import IconButton from '../ds/IconButton.vue';
import type { SketchAspect } from '~/utils/sketch/model';

const aspect = defineModel<SketchAspect>('aspect', { default: 'fit' });
defineProps<{ preferredRatio?: number }>();

const ASPECTS = [
    { value: 'fit', label: 'Fit' },
    { value: '16:9', label: '16:9' },
    { value: '1:1', label: '1:1' },
    { value: 'free', label: 'Free' },
];

const surface = ref<HTMLDivElement>();
const surfaceSize = ref('— × —');
let observer: ResizeObserver | undefined;
onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry!.contentRect;
        surfaceSize.value = `${Math.round(width)} × ${Math.round(height)}`;
    });
    if (surface.value) observer.observe(surface.value);
});
onUnmounted(() => observer?.disconnect());

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
            <IconButton icon="i-lucide-maximize-2" variant="sketch" size="xs" aria-label="Fullscreen canvas" />
            <IconButton icon="i-lucide-circle-dot" variant="sketch" size="xs" aria-label="Capture frame as PNG" />
        </div>

        <div class="sketch-grid-dots grid min-h-0 flex-1 place-items-center p-[26px]">
            <div
                ref="surface"
                class="relative w-full max-w-[760px] border border-(--border-strong) bg-(--surface-sunken)"
                :class="aspect === 'free' && 'h-full'"
                :style="{ ...surfaceStyle, '--ratio': preferredRatio ?? 16 / 9 }"
            >
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
