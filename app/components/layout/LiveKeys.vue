<script setup lang="ts">
/* LiveKeys - Acts 2 and 3 of a live session: the stage itself.

   A two-octave on-screen keyboard plus a status strip that narrates the
   session phase: armed ("play your first note - the clock starts with
   it"), playing (countdown rail), done (new session / change canvas).
   The MIDI monitor doubles as the hardware diagnostic - it names the
   device and echoes every note with velocity, so a keyboard with dead
   keys can be mapped key by key.

   Presentational: note events go up, session state comes down. litNotes
   lets the parent light keys the player didn't press (the ghost demo). */
import type { MidiNoteEvent } from '~/composables/useMidiInput.client';
import Button from '../ds/Button.vue';

export type LiveDockPhase = 'armed' | 'playing' | 'done';

const props = defineProps<{
    phase: LiveDockPhase;
    deviceNames: string[];
    lastEvent: (MidiNoteEvent & { label: string }) | null;
    voiceCount: number;
    /** Phase narration, composed by the parent */
    primaryLine?: string;
    secondaryLine?: string;
    /** 0..1 while playing (time used, or corridor column used) */
    progress?: number | null;
    /** e.g. "0:23 left" or "62% of column" */
    progressLabel?: string | null;
    /** Keys lit by the ghost performance (merged with player presses) */
    litNotes?: number[];
    ghostActive?: boolean;
}>();

const emit = defineEmits<{
    noteOn: [note: number];
    noteOff: [note: number];
    newSession: [];
    changeCanvas: [];
    demo: [];
    exit: [];
}>();

/* Two octaves from C3 (48): wide enough for two hands of melody, narrow
   enough to stay a dock rather than a piano. */
const FIRST_NOTE = 48;
const OCTAVES = 2;
const WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMIS = [1, 3, 6, 8, 10];
/** Position of each black key between its white neighbours, in white-key units */
const BLACK_OFFSETS: Record<number, number> = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };

const whiteKeys = computed(() =>
    Array.from({ length: OCTAVES * 7 }, (_, i) => {
        const octave = Math.floor(i / 7);
        const semi = WHITE_SEMIS[i % 7] ?? 0;
        return { note: FIRST_NOTE + octave * 12 + semi };
    })
);
const whiteCount = OCTAVES * 7;
const blackKeys = computed(() =>
    Array.from({ length: OCTAVES * BLACK_SEMIS.length }, (_, i) => {
        const octave = Math.floor(i / BLACK_SEMIS.length);
        const semi = BLACK_SEMIS[i % BLACK_SEMIS.length] ?? 1;
        return {
            note: FIRST_NOTE + octave * 12 + semi,
            leftPct: (((BLACK_OFFSETS[semi] ?? 1) + octave * 7) / whiteCount) * 100,
        };
    })
);

const pressed = ref(new Set<number>());
const press = (note: number) => {
    if (pressed.value.has(note)) return;
    pressed.value.add(note);
    pressed.value = new Set(pressed.value);
    emit('noteOn', note);
};
const release = (note: number) => {
    if (!pressed.value.delete(note)) return;
    pressed.value = new Set(pressed.value);
    emit('noteOff', note);
};

const isLit = (note: number) => pressed.value.has(note) || (props.litNotes ?? []).includes(note);

const monitorLabel = computed(() => {
    if (!props.lastEvent) return 'awaiting input';
    const { label, velocity, on } = props.lastEvent;
    return `${label} ${on ? '▲' : '▽'} vel ${velocity}`;
});
</script>

<template>
    <div class="ps-glass flex flex-col gap-2.5 border border-(--border-strong) p-3 [clip-path:var(--clip-notch)]">
        <!-- MIDI monitor + exit -->
        <div class="flex items-baseline justify-between gap-4 font-mono text-caption uppercase tracking-label">
            <span :class="deviceNames.length ? 'text-(--accent)' : 'text-(--text-muted)'">
                {{ deviceNames.length ? deviceNames.join(' + ') : 'no midi device - keys below work' }}
            </span>
            <span class="flex items-baseline gap-3 text-(--text-muted)">
                <span>
                    <span class="text-(--scope-cyan) tabular-nums">{{ monitorLabel }}</span>
                    · voices <span class="tabular-nums">{{ voiceCount }}</span>
                </span>
                <button
                    type="button"
                    class="uppercase tracking-label transition-colors hover:text-(--text) focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                    aria-label="Exit live mode"
                    @click="emit('exit')"
                >
                    exit ✕
                </button>
            </span>
        </div>

        <!-- Phase narration -->
        <div v-if="phase === 'armed'" class="flex flex-col items-center gap-1 py-1 text-center">
            <p class="text-detail text-(--text)">{{ primaryLine }}</p>
            <p class="font-mono text-caption uppercase tracking-label text-(--text-muted)">
                {{ secondaryLine }}
                <template v-if="!ghostActive">
                    ·
                    <button
                        type="button"
                        class="uppercase tracking-label text-(--scope-cyan) transition-colors hover:text-(--text) focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                        @click="emit('demo')"
                    >
                        show me ▶
                    </button>
                </template>
            </p>
        </div>

        <div v-else-if="phase === 'playing'" class="flex items-center gap-3 py-1">
            <div class="h-[3px] flex-1 bg-(--surface-raised)">
                <div
                    class="h-full bg-(--accent) transition-[width] duration-300 ease-linear"
                    :style="{ width: `${Math.round((progress ?? 0) * 100)}%` }"
                ></div>
            </div>
            <span class="font-mono text-caption tracking-label text-(--accent) tabular-nums">{{ progressLabel }}</span>
        </div>

        <div v-else class="flex flex-wrap items-center justify-between gap-3 py-0.5">
            <p class="text-detail text-(--text)">{{ primaryLine }}</p>
            <span class="flex gap-2">
                <Button variant="primary" size="sm" label="New session" @click="emit('newSession')" />
                <Button variant="secondary" size="sm" label="Change canvas" @click="emit('changeCanvas')" />
            </span>
        </div>

        <!-- Two-octave keyboard -->
        <div class="relative h-20 select-none touch-none" role="group" aria-label="On-screen keyboard">
            <div class="flex h-full gap-px">
                <button
                    v-for="k in whiteKeys"
                    :key="k.note"
                    type="button"
                    class="h-full flex-1 rounded-none border border-(--border-strong) transition-colors duration-75 focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                    :class="
                        isLit(k.note)
                            ? 'bg-(--accent) shadow-(--shadow-glow-accent)'
                            : 'bg-(--surface-raised) hover:bg-(--surface-overlay)'
                    "
                    :aria-pressed="isLit(k.note)"
                    @pointerdown.prevent="press(k.note)"
                    @pointerup="release(k.note)"
                    @pointerleave="release(k.note)"
                />
            </div>
            <button
                v-for="k in blackKeys"
                :key="k.note"
                type="button"
                class="absolute top-0 z-10 h-[58%] w-[4.5%] -translate-x-1/2 rounded-none border border-(--border-strong) transition-colors duration-75 focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                :class="
                    isLit(k.note) ? 'bg-(--accent) shadow-(--shadow-glow-accent)' : 'bg-(--bg) hover:bg-(--surface)'
                "
                :style="{ left: `${k.leftPct}%` }"
                :aria-pressed="isLit(k.note)"
                @pointerdown.prevent="press(k.note)"
                @pointerup="release(k.note)"
                @pointerleave="release(k.note)"
            />
        </div>
    </div>
</template>
