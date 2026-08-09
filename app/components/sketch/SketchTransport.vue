<script setup lang="ts">
/* Transport bar. Dumb over the player's state: the page owns the
   composable and this only draws + emits. Scrub well pointer maths:
   drag anywhere seeks; the loop handles capture their own drags. The
   played portion is the same bar series overdrawn in ink and clipped
   at the playhead. */
import { computed, ref } from 'vue';
import { formatLoopLabel, formatTime, type LoopRegion } from '~/utils/sketch/audio';
import type { PlayState } from '~/composables/useSketchPlayer';

const props = defineProps<{
    playState: PlayState;
    playhead: number;
    duration: number;
    peaks: number[];
    meter: { left: number; right: number; db: number | null };
    sampleRate: number;
    channelCount: number;
    loop: LoopRegion;
}>();
const emit = defineEmits<{
    play: [];
    pause: [];
    stop: [];
    seek: [seconds: number];
    'toggle-loop': [];
    'set-loop': [patch: Partial<Pick<LoopRegion, 'start' | 'end'>>];
}>();

const hasBuffer = computed(() => props.duration > 0);
const fraction = computed(() => (hasBuffer.value ? Math.min(1, props.playhead / props.duration) : 0));
const time = computed(() => formatTime(props.playhead));

const well = ref<HTMLDivElement>();
function wellSeconds(e: PointerEvent): number {
    const rect = well.value!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return f * props.duration;
}
function onScrub(e: PointerEvent) {
    if (!hasBuffer.value) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    emit('seek', wellSeconds(e));
}
function onScrubMove(e: PointerEvent) {
    if (!hasBuffer.value || e.buttons !== 1) return;
    emit('seek', wellSeconds(e));
}

/* Loop handle drags own their pointer so the well doesn't scrub. */
const draggingHandle = ref<'start' | 'end'>();
function onHandleDown(which: 'start' | 'end', e: PointerEvent) {
    draggingHandle.value = which;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onHandleMove(e: PointerEvent) {
    if (!draggingHandle.value || e.buttons !== 1) return;
    const seconds = wellSeconds(e);
    if (draggingHandle.value === 'start') emit('set-loop', { start: Math.min(seconds, props.loop.end - 0.05) });
    else emit('set-loop', { end: Math.max(seconds, props.loop.start + 0.05) });
}

const METER_ZONE = { ink: 5 } as const;
function segmentClass(index: number, lit: number): string {
    if (index >= lit) return 'bg-(--border)';
    return index < METER_ZONE.ink ? 'bg-(--text)' : 'bg-(--accent)';
}
</script>

<template>
    <footer class="flex items-center gap-[18px] border-t border-(--border-strong) bg-(--surface-elevated) px-[18px] py-3.5">
        <div class="flex border border-(--border-strong)" :class="!hasBuffer && 'opacity-40'">
            <button
                type="button"
                class="grid h-11 w-12 cursor-pointer place-items-center bg-(--accent) transition-colors duration-(--motion-duration-fast) hover:bg-(--sketch-accent-hover)"
                :aria-label="playState === 'playing' ? 'Pause' : 'Play'"
                :disabled="!hasBuffer"
                @click="playState === 'playing' ? emit('pause') : emit('play')"
            >
                {{ playState === 'playing' ? '❙❙' : '▶' }}
            </button>
            <button
                type="button"
                class="grid h-11 w-12 cursor-pointer place-items-center border-l border-(--border-strong) bg-(--surface) transition-colors duration-(--motion-duration-fast) hover:bg-(--bg)"
                aria-label="Stop"
                :disabled="!hasBuffer"
                @click="emit('stop')"
            >
                ■
            </button>
            <button
                type="button"
                class="grid h-11 w-12 cursor-pointer place-items-center border-l border-(--border-strong) transition-colors duration-(--motion-duration-fast)"
                :class="loop.enabled ? 'bg-(--text) text-(--accent)' : 'bg-(--surface) hover:bg-(--bg)'"
                :aria-label="loop.enabled ? 'Disarm loop' : 'Arm loop'"
                :aria-pressed="loop.enabled"
                :disabled="!hasBuffer"
                @click="emit('toggle-loop')"
            >
                ↻
            </button>
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div
                ref="well"
                class="relative h-[38px] touch-none border border-(--border-strong) bg-(--surface-sunken)"
                :class="hasBuffer && 'cursor-ew-resize'"
                @pointerdown="onScrub"
                @pointermove="onScrubMove"
            >
                <div
                    v-if="loop.enabled"
                    class="absolute inset-y-0 bg-(--accent)/28"
                    :style="{ left: `${(loop.start / duration) * 100}%`, width: `${((loop.end - loop.start) / duration) * 100}%` }"
                    aria-hidden="true"
                />
                <svg class="absolute inset-0 h-full w-full" preserveAspectRatio="none" :viewBox="`0 0 ${peaks.length} 2`" aria-hidden="true">
                    <rect
                        v-for="(bar, i) in peaks"
                        :key="i"
                        :x="i + 0.15"
                        :y="1 - Math.max(0.04, bar)"
                        width="0.7"
                        :height="Math.max(0.08, bar * 2)"
                        class="fill-(--text-faint)"
                    />
                </svg>
                <div class="absolute inset-0 overflow-hidden" :style="{ width: `${fraction * 100}%` }" aria-hidden="true">
                    <svg
                        class="h-full"
                        :style="{ width: well ? `${well.getBoundingClientRect().width}px` : '100%' }"
                        preserveAspectRatio="none"
                        :viewBox="`0 0 ${peaks.length} 2`"
                    >
                        <rect
                            v-for="(bar, i) in peaks"
                            :key="i"
                            :x="i + 0.15"
                            :y="1 - Math.max(0.04, bar)"
                            width="0.7"
                            :height="Math.max(0.08, bar * 2)"
                            class="fill-(--text)"
                        />
                    </svg>
                </div>
                <span
                    class="absolute inset-y-0 w-0.5 bg-(--text)"
                    :style="{ left: `calc(${fraction * 100}% - 1px)` }"
                    aria-hidden="true"
                />
                <template v-if="loop.enabled && hasBuffer">
                    <button
                        v-for="which in (['start', 'end'] as const)"
                        :key="which"
                        type="button"
                        class="absolute inset-y-0 w-2 -translate-x-1/2 cursor-col-resize touch-none border-x border-(--text)/35 bg-transparent"
                        :style="{ left: `${((which === 'start' ? loop.start : loop.end) / duration) * 100}%` }"
                        :aria-label="`Loop ${which}`"
                        @pointerdown.stop="onHandleDown(which, $event)"
                        @pointermove="onHandleMove"
                        @pointerup="draggingHandle = undefined"
                    />
                </template>
            </div>
            <div class="flex justify-between font-mono text-(length:--sketch-font-size-micro) tracking-label text-(--text-muted)">
                <span>LOOP {{ formatLoopLabel(loop.start) }} — {{ formatLoopLabel(loop.end) }}</span>
                <span>{{ (sampleRate / 1000).toFixed(1) }} KHZ · {{ channelCount === 1 ? 'MONO' : 'STEREO' }}</span>
            </div>
        </div>

        <span class="font-mono text-(length:--sketch-font-size-time) font-medium tracking-[0.02em]">
            {{ time.main }}<span class="text-(--text-muted)">{{ time.hundredths }}</span>
        </span>

        <div class="flex w-24 shrink-0 flex-col gap-1">
            <div v-for="side in (['left', 'right'] as const)" :key="side" class="flex h-[9px] gap-[3px]">
                <span v-for="i in 8" :key="i" class="flex-1" :class="segmentClass(i - 1, meter[side])" />
            </div>
            <span class="font-mono text-(length:--sketch-font-size-nano) tracking-label-wide text-(--text-muted)">
                OUT {{ meter.db === null ? '—' : meter.db.toFixed(1) }} DB
            </span>
        </div>
    </footer>
</template>
