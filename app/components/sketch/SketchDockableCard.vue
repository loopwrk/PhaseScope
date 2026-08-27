<script setup lang="ts">
/* A card that sits in a row until you pull it out, then floats over the
   page until you drop it back.

   One drag implementation covers both, which is the reason this owns the
   docked state too rather than the row owning it: a drag that begins on a
   docked grip has to survive the card becoming a floating, teleported
   element mid-gesture. Because the listeners live on `window` and this
   component instance persists across the render-branch swap, the pointer
   never notices.

   Teleported while floating, because the workspace columns are full of
   overflow-hidden - a card dragged out of a pane would otherwise clip at
   its edge. The teleport is what makes the theme class on the wrapper
   load-bearing: `.sketch-theme` is a scoped token block, so a card moved
   out to <body> would leave every --surface / --border / --sketch-var
   behind and render in PhaseScope's dark values.

   Dragging starts from an element marked [data-sketch-grip] - the knob's
   label strip - so the card's own gestures (the rotary's vertical drag)
   keep the rest of its surface. */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import {
    dragOrigin,
    movedBeyond,
    moveTo,
    nudge,
    nudgeDelta,
    UNDOCK_THRESHOLD_PX,
    type Point,
    type Size,
} from '~/utils/sketch/floating';

/* null means docked; a point means floating there. */
const placement = defineModel<Point | null>({ default: null });

withDefaults(defineProps<{ width?: number; z?: number }>(), { width: 210, z: 50 });
const emit = defineEmits<{ grab: []; dock: [] }>();

const inline = ref<HTMLElement>();
const floater = ref<HTMLElement>();
const dragging = ref(false);
const floating = computed(() => placement.value !== null);

/* Held so the row keeps its shape while a card is away. */
const gapHeight = ref(0);

let startPointer: Point | undefined;
let origin: Point | undefined;
let size: Size = { width: 0, height: 0 };
let armed = false;

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
const element = () => (floating.value ? floater.value : inline.value);

function onPointerDown(event: PointerEvent) {
    const host = element();
    if (event.button !== 0 || !host) return;
    const target = event.target as HTMLElement | null;
    const grip = host.querySelector('[data-sketch-grip]');
    if (grip && !target?.closest('[data-sketch-grip]')) return;

    startPointer = { x: event.clientX, y: event.clientY };
    armed = true;

    if (placement.value) {
        const rect = host.getBoundingClientRect();
        size = { width: rect.width, height: rect.height };
        origin = dragOrigin(startPointer, placement.value);
        beginDrag();
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
}

function beginDrag() {
    dragging.value = true;
    /* Held on the body so the cursor survives the pointer outrunning the
       card, the same way the knob's drag does. */
    document.body.style.cursor = 'grabbing';
    emit('grab');
}

/* Lift a docked card out at the position it is already occupying, so it
   does not jump to the origin the instant it starts floating. */
function undock(pointer: Point) {
    const host = inline.value;
    if (!host || !startPointer) return;
    const rect = host.getBoundingClientRect();
    size = { width: rect.width, height: rect.height };
    gapHeight.value = rect.height;
    const from = { x: rect.left, y: rect.top };
    origin = dragOrigin(startPointer, from);
    placement.value = moveTo(pointer, origin, size, viewport());
    beginDrag();
}

function onPointerMove(event: PointerEvent) {
    if (!armed) return;
    const pointer = { x: event.clientX, y: event.clientY };
    if (!origin) {
        if (!startPointer || !movedBeyond(startPointer, pointer, UNDOCK_THRESHOLD_PX)) return;
        undock(pointer);
        return;
    }
    event.preventDefault();
    placement.value = moveTo(pointer, origin, size, viewport());
}

/* Letting go never docks. Dropping a card anywhere near its dock used to
   put it back, which fired constantly by accident - the lock is now the
   only way home. */
function endDrag() {
    armed = false;
    dragging.value = false;
    startPointer = undefined;
    origin = undefined;
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
}

/* The pointer-free path. Dragging cannot be the only way in or out of the
   dock, and nothing about a label strip announces itself to a keyboard.
   The handle is a real button, so it tabs; from there the arrows move the
   card and Escape sends it home. Arrows are handled here rather than on
   the rotary because the rotary's arrows already belong to the value. */
function toggle() {
    if (placement.value) {
        emit('dock');
        return;
    }
    const host = inline.value;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    gapHeight.value = rect.height;
    placement.value = moveTo(
        { x: rect.left, y: rect.top },
        { x: 0, y: 0 },
        { width: rect.width, height: rect.height },
        viewport()
    );
}

function onHandleKeydown(event: KeyboardEvent) {
    if (!placement.value || !floater.value) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        emit('dock');
        return;
    }
    const delta = nudgeDelta(event.key, event.shiftKey);
    if (!delta) return;
    event.preventDefault();
    const rect = floater.value.getBoundingClientRect();
    placement.value = nudge(placement.value, delta, { width: rect.width, height: rect.height }, viewport());
}

/* A window that shrinks under a parked card must not strand it - and a
   position restored from storage was saved against whatever window the
   last session had, so the same clamp runs once on mount. Without it a
   card parked near the right edge of a wide monitor comes back off-screen
   on a laptop, with no way to reach it.
   Bound in onMounted rather than behind an import.meta.client guard: that
   flag is a Nuxt build-time constant and is undefined in Storybook, so the
   guard silently skipped the listener there. */
function onResize() {
    if (!placement.value || !floater.value) return;
    const rect = floater.value.getBoundingClientRect();
    placement.value = moveTo(
        { x: rect.left, y: rect.top },
        { x: 0, y: 0 },
        { width: rect.width, height: rect.height },
        viewport()
    );
}

onMounted(() => {
    window.addEventListener('resize', onResize);
    /* after the teleport has rendered, so the card has a size to clamp */
    void nextTick(onResize);
});
onUnmounted(() => {
    endDrag();
    window.removeEventListener('resize', onResize);
});
</script>

<template>
    <div v-if="!floating" ref="inline" class="sketch-dockable" @pointerdown="onPointerDown">
        <slot :floating="false" :toggle="toggle" :on-handle-keydown="onHandleKeydown" />
    </div>

    <template v-else>
        <!-- Keeps the row's shape while the card is away, and keeps the
             dock a real drop target even when everything has left it. -->
        <div
            class="border border-dashed border-(--border) bg-(--surface)/40"
            :style="{ height: `${gapHeight}px` }"
            aria-hidden="true"
        />

        <Teleport to="body">
            <div
                ref="floater"
                class="sketch-theme sketch-dockable sketch-floating fixed top-0 left-0 bg-transparent"
                :data-dragging="dragging"
                :style="{
                    transform: `translate3d(${placement!.x}px, ${placement!.y}px, 0)`,
                    width: `${width}px`,
                    zIndex: z,
                }"
                @pointerdown="onPointerDown"
            >
                <slot :floating="true" :toggle="toggle" :on-handle-keydown="onHandleKeydown" />
            </div>
        </Teleport>
    </template>
</template>
