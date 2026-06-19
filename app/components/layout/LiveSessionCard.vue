<script setup lang="ts">
/* LiveSessionCard - Act 1 of a live session: the stage door.

   Two choices and a button; the choices are the onboarding. Picking
   between an endless tunnel / one globe / one twisted loop teaches the
   topology concept; picking a session length teaches that live drawing
   is time-bound. Both are locked once the session starts - the moment
   for choosing visibly passes when you take the stage.
   Controlled: the parent owns topology + duration state. */
import Button from '../ds/Button.vue';
import type { TopologyMode } from '~/utils/topologies';
import { LIVE_VOICES, LIVE_VOICE_IDS, type LiveVoiceId } from '~/utils/liveVoices';

const props = defineProps<{
    deviceNames: string[];
}>();

const topology = defineModel<TopologyMode>('topology', { default: 'corridor' });
const duration = defineModel<number>('duration', { default: 60 });
const voice = defineModel<LiveVoiceId>('voice', { default: 'warm' });

const emit = defineEmits<{
    start: [];
    cancel: [];
}>();

// `disabled` greys a canvas out ("track only") - currently unused (no live
// canvas sets it) but kept and typed optional so the template guards type-check.
const CANVASES: { id: TopologyMode; label: string; hint: string; icon: string; disabled?: boolean }[] = [
    { id: 'corridor', label: 'Corridor', hint: 'endless tunnel', icon: 'i-lucide-rows-3' },
    { id: 'sphere', label: 'Sphere', hint: 'one globe', icon: 'i-lucide-globe' },
    { id: 'mobius', label: 'Möbius', hint: 'one twisted loop', icon: 'i-lucide-infinity' },
];

const LENGTH_CHIPS = [
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '2m', value: 120 },
    { label: '5m', value: 300 },
    { label: '10m', value: 600 },
] as const;

// "custom…" opens a fine-grained slider; it stays open while the chosen
// value isn't one of the chips
const customOpen = ref(!LENGTH_CHIPS.some((c) => c.value === duration.value));
const pickChip = (value: number) => {
    duration.value = value;
    customOpen.value = false;
};

const durationLabel = computed(() => {
    const d = duration.value;
    return `${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')}`;
});

const pickCanvas = (id: TopologyMode, disabled?: boolean) => {
    if (disabled) return;
    topology.value = id;
};
</script>

<template>
    <div
        class="ps-glass flex w-[min(92vw,34rem)] flex-col gap-5 border border-(--border-strong) p-6 [clip-path:var(--clip-notch)]"
        role="dialog"
        aria-label="Live session setup"
    >
        <div class="flex items-center justify-between">
            <span class="font-mono text-heading uppercase tracking-label-wide text-(--text-muted)">Live session</span>
            <button
                type="button"
                class="text-(--text-muted) transition-colors hover:text-(--text) focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                aria-label="Cancel live session"
                @click="emit('cancel')"
            >
                <UIcon name="i-lucide-x" class="size-4" />
            </button>
        </div>

        <!-- Choose your canvas -->
        <div class="flex flex-col gap-2.5">
            <span class="font-display text-detail font-semibold text-(--accent)">Choose your canvas</span>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                    v-for="c in CANVASES"
                    :key="c.id"
                    type="button"
                    class="flex flex-col items-center gap-1.5 rounded-none border px-2 py-3 transition-[border-color,box-shadow] duration-150 [clip-path:var(--clip-chamfer-sm)] focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                    :class="[
                        c.disabled
                            ? 'cursor-not-allowed border-dashed border-(--border) opacity-50'
                            : topology === c.id
                              ? 'border-(--accent) shadow-(--shadow-glow-accent)'
                              : 'border-(--border-strong) hover:border-(--text-muted)',
                    ]"
                    :aria-pressed="topology === c.id"
                    :aria-disabled="c.disabled || undefined"
                    @click="pickCanvas(c.id, c.disabled)"
                >
                    <UIcon
                        :name="c.icon"
                        class="size-5"
                        :class="topology === c.id && !c.disabled ? 'text-(--accent)' : 'text-(--text-muted)'"
                    />
                    <span class="text-detail" :class="c.disabled ? 'text-(--text-muted)' : ''">{{ c.label }}</span>
                    <span class="text-caption text-(--text-muted)">{{ c.hint }}</span>
                </button>
            </div>
        </div>

        <!-- Voice: the brush (swappable mid-session from Display Settings) -->
        <div class="flex flex-col gap-2.5">
            <span class="font-display text-detail font-semibold text-(--accent)">Voice</span>
            <div class="flex flex-wrap items-center gap-2">
                <button
                    v-for="id in LIVE_VOICE_IDS"
                    :key="id"
                    type="button"
                    class="rounded-none border px-3 py-1 font-mono text-caption tracking-label transition-colors duration-150 [clip-path:var(--clip-chamfer-sm)] focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                    :class="
                        voice === id
                            ? 'border-(--accent) text-(--accent)'
                            : 'border-(--border-strong) text-(--text-muted) hover:text-(--text)'
                    "
                    :aria-pressed="voice === id"
                    @click="voice = id"
                >
                    {{ LIVE_VOICES[id].label }}
                </button>
            </div>
            <p class="text-caption text-(--text-muted)">{{ LIVE_VOICES[voice].hint }}</p>
        </div>

        <!-- Session length -->
        <div class="flex flex-col gap-2.5">
            <span class="font-display text-detail font-semibold text-(--accent)"
                >Session length
                <span class="ml-1 font-mono text-caption font-normal normal-case text-(--text-muted)"
                    >— locked once you play</span
                ></span
            >
            <div class="flex flex-wrap items-center gap-2">
                <button
                    v-for="chip in LENGTH_CHIPS"
                    :key="chip.value"
                    type="button"
                    class="rounded-none border px-3 py-1 font-mono text-caption tracking-label transition-colors duration-150 [clip-path:var(--clip-chamfer-sm)] focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                    :class="
                        !customOpen && duration === chip.value
                            ? 'border-(--accent) text-(--accent)'
                            : 'border-(--border-strong) text-(--text-muted) hover:text-(--text)'
                    "
                    @click="pickChip(chip.value)"
                >
                    {{ chip.label }}
                </button>
                <button
                    type="button"
                    class="rounded-none border px-3 py-1 font-mono text-caption tracking-label transition-colors duration-150 [clip-path:var(--clip-chamfer-sm)] focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                    :class="
                        customOpen
                            ? 'border-(--accent) text-(--accent)'
                            : 'border-(--border-strong) text-(--text-muted) hover:text-(--text)'
                    "
                    @click="customOpen = true"
                >
                    custom…
                </button>
                <span
                    v-if="customOpen"
                    class="ml-auto font-mono text-caption tracking-label text-(--accent) tabular-nums"
                    >{{ durationLabel }}</span
                >
            </div>
            <DsSlider v-if="customOpen" v-model="duration" :min="5" :max="600" :step="5" />
        </div>

        <!-- Device status + CTA -->
        <div class="flex items-center justify-between gap-4 border-t border-(--border) pt-4">
            <span class="font-mono text-caption uppercase tracking-label text-(--text-muted)">
                <template v-if="props.deviceNames.length">
                    <span class="text-(--accent)">{{ props.deviceNames.join(' + ') }}</span> connected
                </template>
                <template v-else>no MIDI - on-screen keys work</template>
            </span>
            <Button variant="primary" icon="i-lucide-keyboard-music" label="Start" @click="emit('start')" />
        </div>
    </div>
</template>
