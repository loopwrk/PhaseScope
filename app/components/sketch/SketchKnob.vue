<script setup lang="ts">
/* DAW-style rotary knob - KNOB.md, approved option 2d "Panel".

   One knob is one front-panel module: screened label strip, engraved
   rotary, numeric readout footer. (The spec's MIN/MAX screening row is
   dropped - the ends are legible from the arc, and the row cost more
   column height than it earned.) Vertical drag is the gesture, never
   rotational following: the pointer sets `t` from the drag
   origin each move, so a drag cannot accumulate drift, and swapping the
   fine gear re-anchors rather than snapping the value.

   The arc and the indicator are both derived from the same `t`, which is
   what keeps them honest at every position. Everything numeric lives in
   knob-geometry.ts so the spec's acceptance checks are unit-tested. */
import { computed, onUnmounted, nextTick, ref } from 'vue';
import {
    angleFor,
    arcPath,
    dashArray,
    dragTo,
    tickMarks,
    tToValue,
    valueToT,
    KNOB_DEFAULT_SWEEP,
    type DragAnchor,
    type KnobTaper,
} from '~/utils/sketch/knob-geometry';

const value = defineModel<number>({ default: 0 });

const props = withDefaults(
    defineProps<{
        min: number;
        max: number;
        step?: number;
        symbol: string;
        label: string;
        unit?: string;
        /* The variable's colour in the equation above; falls back to the
           signal yellow when the knob stands alone. */
        color?: string;
        format?: (value: number) => string;
        sweep?: number;
        taper?: KnobTaper;
        disabled?: boolean;
        /* Same box, same rotary, same labels - the padding gives instead,
           saving ~50px of column height per card. Dense is the default:
           KNOB.md's roomier padding is a knob standing on its own, and in
           practice these live several to a row in a column that is already
           short. Pass :dense="false" for the spec's spacing. */
        dense?: boolean;
    }>(),
    { unit: '', color: 'var(--accent)', sweep: KNOB_DEFAULT_SWEEP, taper: 'linear', disabled: false, dense: true }
);

const range = computed(() => ({ min: props.min, max: props.max, taper: props.taper, step: props.step }));
const t = computed(() => valueToT(value.value, range.value));

const ticks = computed(() => tickMarks(props.sweep));
const track = computed(() => arcPath(props.sweep));
const valueDash = computed(() => dashArray(t.value, props.sweep));
const indicatorTransform = computed(() => `rotate(${angleFor(t.value, props.sweep)} 50 50)`);

const readout = computed(() => (props.format ?? ((v: number) => v.toFixed(2)))(value.value));

/* The default a double-click returns to - whatever it was first given. */
const initial = value.value;

function commit(next: number) {
    if (props.disabled) return;
    value.value = next;
}
function setT(next: number) {
    commit(tToValue(next, range.value));
}
function nudge(fraction: number) {
    setT(t.value + fraction);
}

/* --- Drag ------------------------------------------------------------ */
const dragging = ref(false);
let anchor: DragAnchor | undefined;

function onPointerDown(event: PointerEvent) {
    if (props.disabled || event.button !== 0) return;
    (event.currentTarget as HTMLElement).focus();
    anchor = { startY: event.clientY, startT: t.value, fine: event.shiftKey };
    dragging.value = true;
    /* Held on the body so the cursor does not flicker when the pointer
       leaves the card mid-drag. */
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
}

function onPointerMove(event: PointerEvent) {
    if (!anchor) return;
    event.preventDefault();
    const next = dragTo(anchor, event.clientY, event.shiftKey);
    anchor = next.anchor;
    setT(next.t);
}

function endDrag() {
    dragging.value = false;
    anchor = undefined;
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
}
onUnmounted(endDrag);

/* --- Wheel and keyboard ---------------------------------------------- */
function onWheel(event: WheelEvent) {
    if (props.disabled) return;
    event.preventDefault();
    nudge((event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? 0.001 : 0.01));
}

function onKeydown(event: KeyboardEvent) {
    if (props.disabled) return;
    const fine = event.shiftKey ? 0.001 : 0.01;
    const handlers: Record<string, () => void> = {
        ArrowUp: () => nudge(fine),
        ArrowRight: () => nudge(fine),
        ArrowDown: () => nudge(-fine),
        ArrowLeft: () => nudge(-fine),
        PageUp: () => nudge(event.shiftKey ? 0.001 : 0.1),
        PageDown: () => nudge(event.shiftKey ? -0.001 : -0.1),
        Home: () => setT(0),
        End: () => setT(1),
    };
    const handler = handlers[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
}

/* --- Typed value ------------------------------------------------------ */
const editing = ref(false);
const draft = ref('');
const input = ref<HTMLInputElement>();

function startEditing() {
    if (props.disabled) return;
    draft.value = readout.value;
    editing.value = true;
    nextTick(() => input.value?.select());
}
function commitDraft() {
    if (!editing.value) return;
    editing.value = false;
    const typed = Number(draft.value.trim());
    if (!Number.isFinite(typed)) return;
    commit(tToValue(valueToT(typed, range.value), range.value));
}
</script>

<template>
    <div
        class="flex flex-col border border-(--border-strong) bg-(--surface-elevated) shadow-(--sketch-shadow-knob)"
        :class="disabled && 'opacity-40'"
    >
        <!-- data-sketch-grip: the drag handle when this card is floating.
             It is the label strip on purpose - the rotary below owns the
             vertical drag, so the two gestures must not share a surface. -->
        <div
            data-sketch-grip
            class="flex items-center gap-2 border-b border-(--border)"
            :class="dense ? 'px-2 py-1' : 'px-2.5 py-2'"
        >
            <span class="text-[17px] leading-none italic" :style="{ color, fontFamily: 'KaTeX_Math, serif' }">
                {{ symbol }}
            </span>
            <span class="font-mono text-[9px] tracking-[0.14em] text-(--text-muted) uppercase">{{ label }}</span>
            <span class="flex-1" />
            <!-- Neutral extension point: the knob knows nothing about
                 docking, but the card wrapping it puts its handle here. -->
            <slot name="action" />
            <span class="size-2 shrink-0" :style="{ backgroundColor: color }" aria-hidden="true" />
        </div>

        <div
            class="grid touch-none place-items-center select-none"
            :class="[dense ? 'px-2 py-1.5' : 'px-2.5 pt-4 pb-2.5', disabled ? 'cursor-not-allowed' : 'cursor-ns-resize']"
            role="slider"
            :tabindex="disabled ? -1 : 0"
            :aria-label="label"
            :aria-valuemin="min"
            :aria-valuemax="max"
            :aria-valuenow="value"
            :aria-valuetext="unit ? `${readout} ${unit}` : readout"
            :aria-disabled="disabled || undefined"
            @pointerdown="onPointerDown"
            @wheel="onWheel"
            @keydown="onKeydown"
            @dblclick="commit(initial)"
        >
            <svg
                class="size-[98px] max-[600px]:size-[88px] [@media(max-height:820px)]:size-[76px]"
                viewBox="0 0 100 100"
                aria-hidden="true"
                focusable="false"
            >
                <line
                    v-for="(tick, i) in ticks"
                    :key="i"
                    :x1="tick.x1"
                    :y1="tick.y1"
                    :x2="tick.x2"
                    :y2="tick.y2"
                    stroke="var(--text-faint)"
                    :stroke-width="tick.long ? 1.6 : 1"
                />
                <path :d="track" fill="none" stroke="var(--border)" stroke-width="3.5" />
                <path :d="track" fill="none" :stroke="color" stroke-width="3.5" :stroke-dasharray="valueDash" />
                <circle cx="50" cy="50" r="27" fill="var(--sketch-knob-cap)" />
                <circle cx="50" cy="50" r="21" fill="none" stroke="var(--sketch-knob-lip)" stroke-width="1" />
                <g :transform="indicatorTransform">
                    <line
                        x1="50"
                        y1="45"
                        x2="50"
                        y2="28"
                        :stroke="dragging ? 'var(--sketch-accent-hover)' : 'var(--accent)'"
                        stroke-width="3"
                        stroke-linecap="square"
                        class="transition-colors duration-150"
                    />
                </g>
            </svg>
        </div>

        <div class="border-t border-(--border-strong) bg-(--surface)" :class="dense ? 'px-2 py-1' : 'px-2.5 py-[9px]'">
            <input
                v-if="editing"
                ref="input"
                v-model="draft"
                type="text"
                inputmode="decimal"
                class="w-full bg-transparent text-center font-mono text-[15px] tracking-[0.02em] text-(--text)"
                :aria-label="`${label} value`"
                @blur="commitDraft"
                @keydown.enter="commitDraft"
                @keydown.esc="editing = false"
            />
            <button
                v-else
                type="button"
                class="flex w-full items-baseline justify-center gap-[7px]"
                :class="disabled ? 'cursor-not-allowed' : 'cursor-text'"
                :disabled="disabled"
                :aria-label="`Type a ${label} value`"
                @click="startEditing"
            >
                <span class="font-mono text-[15px] tracking-[0.02em] text-(--text)">{{ readout }}</span>
                <span v-if="unit" class="font-mono text-[9px] tracking-[0.1em] text-(--text-muted)">{{ unit }}</span>
            </button>
        </div>
    </div>
</template>
