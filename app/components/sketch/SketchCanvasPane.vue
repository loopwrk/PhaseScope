<script setup lang="ts">
/* The visual column: canvas toolbar + maths preview + dotted well. The
   maths tab renders as a KaTeX block directly above the well, so the
   equation and the wave it describes read as one thing. The surface hosts a
   real canvas the sketch's renderFrame draws into each rAF; on a render
   error the loop stops and the last good frame stays up, per spec. The
   px readout reports the canvas backing size. Corner labels are chrome
   the sketch will be able to set later - static mock values for now. */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import SegmentedControl from '../ds/SegmentedControl.vue';
import IconButton from '../ds/IconButton.vue';
import SketchMathsPreview from './SketchMathsPreview.vue';
import SketchKnob from './SketchKnob.vue';
import SketchDockableCard from './SketchDockableCard.vue';
import { createFrameClock } from '~/utils/sketch/frame-clock';
import { readPlacements, type Point } from '~/utils/sketch/floating';
import { extractParams, nameForGlyph, setParamValue } from '~/utils/sketch/params';
import { formatFor, knobsFor } from '~/utils/sketch/param-ranges';
import type { SketchAspect } from '~/utils/sketch/model';
import type { RenderFrame } from '~/utils/sketch/runner';

const aspect = defineModel<SketchAspect>('aspect', { default: 'fit' });
/* Two-way: the equation's inline param inputs write back through here. */
const maths = defineModel<string>('maths', { default: '' });
/* compact: the mobile band - fixed height, no toolbar, corner label
   carries the aspect (the control itself lives in the sheet). */
const props = defineProps<{
    preferredRatio?: number;
    renderFrame?: RenderFrame;
    running?: boolean;
    compact?: boolean;
    /* Whether time should advance. False holds the last frame on screen
       at the phase it froze on, rather than blanking the canvas. */
    animating?: boolean;
    /* Changing this repaints one frame while frozen - that is how a param
       edit shows up with no animation running. */
    repaintKey?: unknown;
    /* Parameter names that cannot be driven right now - their knob and
       their inline field both refuse. */
    lockedParams?: readonly string[];
}>();
const emit = defineEmits<{ capture: [dataUrl: string]; 'render-error': [message: string] }>();

const ASPECTS = [
    { value: 'fit', label: 'Fit' },
    { value: '16:9', label: '16:9' },
    { value: '1:1', label: '1:1' },
    { value: 'free', label: 'Free' },
];

const surface = ref<HTMLElement>();
const well = ref<HTMLElement>();
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
    /* Resizing wipes the backing store; put the held frame back. */
    if (!props.animating) repaint();
}

/* One knob per exposed variable, tinted with the colour the equation gave
   that symbol, sitting between the equation and the well (KNOB.md 7). */
const equationColours = ref(new Map<string, string>());
/* Re-keyed from rendered glyphs to parameter names - the equation and the
   params bar spell some letters with different code points. */
const colourByParam = computed(() => {
    const byName = new Map<string, string>();
    for (const [glyph, colour] of equationColours.value) byName.set(nameForGlyph(glyph), colour);
    return byName;
});
const knobs = computed(() => knobsFor(extractParams(maths.value)));
function knobColour(name: string): string {
    return colourByParam.value.get(name) ?? 'var(--accent)';
}
const isLocked = (name: string) => (props.lockedParams ?? []).includes(name);

/* Where each knob is: absent means docked in the row, a point means
   floating there.

   Persisted globally rather than per sketch, and keyed by parameter name:
   this is a workspace preference, not sketch content. Pull the frequency
   knob out once and it stays out for every sketch that has an `f`, the
   way a DAW remembers its window layout between projects. Only floating
   cards are stored - docking deletes the key rather than writing null, so
   the entry does not linger for every parameter ever seen. */
const placements = usePersistedState<Record<string, Point>>('sketch:knob-placements', () => ({}));
const dock = ref<HTMLElement>();

/* Storage is not trusted on the way in; each card then clamps its own
   restored position once it knows its size (see SketchDockableCard). */
onMounted(() => {
    placements.value = readPlacements(placements.value);
});

/* Most recently grabbed card sits on top. */
const zOrder = ref<Record<string, number>>({});
let nextZ = 50;
function bringToFront(name: string) {
    zOrder.value = { ...zOrder.value, [name]: ++nextZ };
}

/* Dropped over the row - dock it again. The row keeps its footprint while
   cards are away (each leaves a placeholder), so it stays a real target
   even when every knob has been pulled out. */
function dockCard(name: string) {
    /* Rebuilt rather than deleted in place: only floating cards are stored,
       so the key has to go, not be set to null. */
    placements.value = Object.fromEntries(Object.entries(placements.value).filter(([key]) => key !== name));
}

/* An escape hatch, and the only way back if a layout goes wrong - the
   placements persist, so a bad one would otherwise stay bad. */
/* The canvas rides in the same placement map as the knobs, under a key no
   parameter can take (parameter names come from TeX identifiers). */
const CANVAS_KEY = '@canvas';
const canvasFloating = computed(() => Boolean(placements.value[CANVAS_KEY]));
/* The canvas is one size wherever it is - only fullscreen changes it. The
   well keeps its own dimensions while the canvas is away (it is flex-1,
   and the placeholder holds its footprint), so the same measurement that
   sizes it docked also sizes it floating. */
const surfaceWidth = ref(0);

const floatingCount = computed(() => Object.keys(placements.value).length);
function dockAll() {
    placements.value = {};
}

/* The canvas has no grip while docked, so the toolbar pin is its way out.
   Done here rather than through the card: the pane already holds the
   surface element, so it can measure where the canvas is sitting and lift
   it from exactly there. */
function toggleCanvas() {
    if (canvasFloating.value) {
        dockCard(CANVAS_KEY);
        return;
    }
    const rect = surface.value?.getBoundingClientRect();
    if (!rect) return;
    placements.value = { ...placements.value, [CANVAS_KEY]: { x: rect.left, y: rect.top } };
}

/* A drag emits on every move so the canvas and the audio follow the knob
   live; re-rendering the equation that often is the expensive part, so it
   is held until the values settle (KNOB.md 5). */
const holdEquation = ref(false);
let holdTimer: ReturnType<typeof setTimeout> | undefined;
function commitParam(name: string, next: number) {
    maths.value = setParamValue(maths.value, name, next);
    holdEquation.value = true;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => (holdEquation.value = false), 150);
}
onUnmounted(() => clearTimeout(holdTimer));

/* The largest box of the chosen ratio that fits the well, on both axes.
   CSS cannot express this: aspect-ratio honours whichever of width and
   height is definite and lets the other overflow, so with a width set
   the box grows past the bottom of a short pane. Measuring both axes
   here is the reliable version. */
const MAX_SURFACE_WIDTH = 760;

function ratioFor(availableWidth: number, availableHeight: number): number {
    if (aspect.value === 'free') return availableWidth / Math.max(1, availableHeight);
    if (aspect.value === '16:9') return 16 / 9;
    if (aspect.value === '1:1') return 1;
    return props.preferredRatio ?? 16 / 9; // 'fit'
}

function layoutSurface() {
    if (props.compact || !surface.value || !well.value) return;
    const box = getComputedStyle(well.value);
    const availableWidth = Math.max(
        0,
        well.value.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)
    );
    const availableHeight = Math.max(
        0,
        well.value.clientHeight - parseFloat(box.paddingTop) - parseFloat(box.paddingBottom)
    );
    const ratio = ratioFor(availableWidth, availableHeight);
    const width = Math.max(1, Math.min(availableWidth, MAX_SURFACE_WIDTH, availableHeight * ratio));
    surface.value.style.width = `${width}px`;
    surface.value.style.height = `${width / ratio}px`;
    surfaceWidth.value = width;
}

onMounted(() => {
    /* Observe the well, never the surface we resize - observing our own
       output is how a ResizeObserver loop starts. The compact band has no
       well; it is sized by the layout and only the canvas needs fitting. */
    const target = props.compact ? surface.value : well.value;
    observer = new ResizeObserver(() => {
        layoutSurface();
        fitCanvas();
    });
    if (target) observer.observe(target);
    layoutSurface();
    fitCanvas();
});

watch([aspect, () => props.preferredRatio, canvasFloating], async () => {
    /* Wait for the teleport to settle before measuring the new home. */
    await nextTick();
    layoutSurface();
    fitCanvas();
});
onUnmounted(() => {
    observer?.disconnect();
    cancelAnimationFrame(raf);
});

/* Painting and the loop that drives it.

   The clock only ticks while `animating`, so the canvas follows the
   audio: it moves while a sketch plays (and keeps moving while it
   loops), then freezes. Nothing clears the canvas on the way out, so
   the last frame simply stays up. A repaint while frozen redraws that
   same instant with whatever the params now say - new picture, no
   motion. */
const clock = createFrameClock();
let raf = 0;

function paint(seconds: number): boolean {
    const ctx = canvas.value?.getContext('2d');
    if (!props.renderFrame || !ctx) return false;
    try {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        props.renderFrame(ctx, seconds);
        return true;
    } catch (error) {
        emit('render-error', error instanceof Error ? error.message : String(error));
        return false;
    }
}

function frame(nowMs: number) {
    if (!props.renderFrame || !props.running || !props.animating) return;
    if (!paint(clock.advance(nowMs))) return;
    raf = requestAnimationFrame(frame);
}

/* Repaint the held frame. Safe to call at any time - it is a no-op
   without a frame function or a canvas. */
function repaint() {
    paint(clock.seconds);
}

watch(
    () => [props.renderFrame, props.running, props.animating] as const,
    () => {
        cancelAnimationFrame(raf);
        if (props.renderFrame && props.running && props.animating) {
            clock.start(performance.now());
            raf = requestAnimationFrame(frame);
        } else {
            clock.stop();
            /* Draw once on the way to frozen, so a sketch that is run
               while stopped still shows something. */
            repaint();
        }
    },
    /* immediate so a layout-change remount picks the loop back up */
    { immediate: true }
);

/* A param edit while nothing is animating still has to show. */
watch(
    () => props.repaintKey,
    () => {
        if (!props.animating) repaint();
    }
);

function capture() {
    if (!canvas.value) return;
    emit('capture', canvas.value.toDataURL('image/png'));
}

function fullscreen() {
    void surface.value?.requestFullscreen?.();
}
</script>

<template>
    <template v-if="compact">
        <SketchMathsPreview
            v-model="maths"
            :hold="holdEquation"
            :locked="lockedParams"
            @colours="equationColours = $event"
        />

        <div v-if="knobs.length" class="flex flex-wrap gap-3 border-b border-(--border-strong) px-3.5 py-3">
            <div
                v-for="knob in knobs"
                :key="knob.name"
                class="min-w-0 flex-1 basis-[190px]"
                :title="isLocked(knob.name) ? 'Locked while playing' : undefined"
            >
                <SketchKnob
                    :model-value="knob.value"
                    :min="knob.min"
                    :max="knob.max"
                    :step="knob.step"
                    :symbol="knob.symbol"
                    :label="knob.label"
                    :unit="knob.unit"
                    :taper="knob.taper"
                    :color="knobColour(knob.name)"
                    :format="formatFor(knob)"
                    :disabled="isLocked(knob.name)"
                    @update:model-value="commitParam(knob.name, $event)"
                />
            </div>
        </div>

        <section
            ref="surface"
            class="relative h-[270px] shrink-0 border-b border-(--border-strong) bg-(--surface-sunken)"
        >
            <canvas ref="canvas" class="absolute inset-0 h-full w-full" />
            <span class="corner-label absolute top-2 left-2.5 text-(--text-muted) uppercase">
                Canvas · {{ aspect }}
            </span>
        </section>
    </template>

    <section v-else class="flex min-w-0 flex-1 flex-col bg-(--surface)">
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
            <IconButton
                :icon="canvasFloating ? 'i-lucide-lock-open' : 'i-lucide-lock'"
                variant="sketch"
                size="xs"
                :aria-label="canvasFloating ? 'Lock canvas back in place' : 'Unlock canvas'"
                :title="canvasFloating ? 'Lock the canvas back into the well' : 'Unlock the canvas to move it'"
                @click="toggleCanvas"
            />
            <IconButton
                v-if="floatingCount"
                icon="i-lucide-layout-grid"
                variant="sketch"
                size="xs"
                :aria-label="`Dock all ${floatingCount} floating knobs`"
                title="Dock all knobs"
                @click="dockAll"
            />
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

        <SketchMathsPreview
            v-model="maths"
            :hold="holdEquation"
            :locked="lockedParams"
            @colours="equationColours = $event"
        />

        <div v-if="knobs.length" ref="dock" class="flex flex-wrap gap-4 border-b border-(--border) px-4 py-3.5">
            <div
                v-for="knob in knobs"
                :key="knob.name"
                class="min-w-0 flex-1 basis-[190px]"
                :title="isLocked(knob.name) ? 'Locked while playing' : undefined"
            >
                <SketchDockableCard
                    v-slot="{ floating, toggle, onHandleKeydown }"
                    v-model="placements[knob.name]"
                    :z="zOrder[knob.name] ?? 50"
                    @grab="bringToFront(knob.name)"
                    @dock="dockCard(knob.name)"
                >
                    <SketchKnob
                        :model-value="knob.value"
                        :min="knob.min"
                        :max="knob.max"
                        :step="knob.step"
                        :symbol="knob.symbol"
                        :label="knob.label"
                        :unit="knob.unit"
                        :taper="knob.taper"
                        :color="knobColour(knob.name)"
                        :format="formatFor(knob)"
                        :disabled="isLocked(knob.name)"
                        @update:model-value="commitParam(knob.name, $event)"
                    >
                        <template #action>
                            <button
                                data-sketch-handle
                                type="button"
                                class="grid cursor-pointer place-items-center px-0.5 text-(--text-muted) hover:text-(--text)"
                                :aria-label="floating ? `Lock ${knob.label} back in place` : `Unlock ${knob.label}`"
                                :title="
                                    floating
                                        ? 'Lock back into the row (or Escape; arrows move it)'
                                        : 'Unlock to move it - or drag the label strip'
                                "
                                @click="toggle"
                                @keydown="onHandleKeydown"
                            >
                                <UIcon
                                    :name="floating ? 'i-lucide-lock-open' : 'i-lucide-lock'"
                                    class="size-3"
                                />
                            </button>
                        </template>
                    </SketchKnob>
                </SketchDockableCard>
            </div>
        </div>

        <div ref="well" class="sketch-grid-dots grid min-h-[150px] flex-1 place-items-center p-[26px]">
            <SketchDockableCard
                v-slot="{ floating, toggle, onHandleKeydown }"
                v-model="placements[CANVAS_KEY]"
                :width="surfaceWidth"
                :z="zOrder[CANVAS_KEY] ?? 50"
                @grab="bringToFront(CANVAS_KEY)"
                @dock="dockCard(CANVAS_KEY)"
            >
                <!-- Only shown once it is out: docked, the canvas keeps the
                     bare well it has always had, and the toolbar's pin does
                     the undocking. -->
                <div
                    v-if="floating"
                    data-sketch-grip
                    class="flex items-center gap-2 border border-b-0 border-(--border-strong) bg-(--surface-elevated) px-2 py-1"
                >
                    <span
                        class="font-mono text-[9px] tracking-[0.14em] text-(--text-muted) uppercase"
                    >
                        Canvas
                    </span>
                    <span class="flex-1" />
                    <button
                        data-sketch-handle
                        type="button"
                        class="grid cursor-pointer place-items-center px-0.5 text-(--text-muted) hover:text-(--text)"
                        aria-label="Lock canvas back in place"
                        title="Lock back into the well (or Escape; arrows move it)"
                        @click="toggle"
                        @keydown="onHandleKeydown"
                    >
                        <UIcon name="i-lucide-lock-open" class="size-3" />
                    </button>
                </div>
            <!-- width and height are set by layoutSurface() -->
            <div ref="surface" class="relative border border-(--border-strong) bg-(--surface-sunken)">
                <canvas ref="canvas" class="absolute inset-0 h-full w-full" />
                <span class="corner-label absolute top-2 left-2.5 flex flex-col gap-0.5">
                    <span class="text-(--text-muted)">RE · K=17</span>
                    <span class="text-(--sketch-accent-ink)">IM · K=17</span>
                </span>
                <span class="corner-label absolute right-2.5 bottom-2 text-(--text-muted)">N = 1024</span>
            </div>
            </SketchDockableCard>
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
