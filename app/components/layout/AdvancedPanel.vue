<script setup lang="ts">
/* AdvancedPanel - the collapsible "Oscillation Mode" disclosure that lives at
   the foot of the Display Settings panel (slotted via DisplayPanel's #advanced
   slot, like the design comp). The disclosure label IS the section title,
   since the mode selector is all it holds.
   Controlled: every setting is a v-model and the parent owns the engine state. */
import RadioGroup from '../ds/RadioGroup.vue';

const open = defineModel<boolean>('open', { default: false });
const mode = defineModel<string | number>('mode', { default: 'wave' });

const OSCILLATION_LABELS: Record<string, string> = {
    wave: 'Wave',
    'per-point': 'Per-point',
    'per-frame': 'Per-frame',
};
const OSCILLATION_DESCRIPTIONS: Record<string, string> = {
    wave: 'Loudness as a ripple propagating through the structure. Oscillates at a fixed visible speed; intensity tracks amplitude.',
    'per-point': 'Local frequency content. Each point oscillates at its own rate, derived from the audio there.',
    'per-frame':
        'Average frequency per frame. Points in a frame move together - bass-heavy moments slower, treble faster.',
};
// Description rides on the selected option only, like the topology list
const oscillationItems = computed(() =>
    Object.keys(OSCILLATION_LABELS).map((value) => ({
        label: OSCILLATION_LABELS[value]!,
        value,
        description: mode.value === value ? OSCILLATION_DESCRIPTIONS[value] : undefined,
    }))
);
</script>

<template>
    <div class="mt-5 border-t border-(--border)">
        <button
            type="button"
            class="flex w-full items-center justify-between gap-2 pb-1 pt-3 font-display text-detail font-semibold transition-[box-shadow] duration-150 focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
            :aria-expanded="open"
            @click="open = !open"
        >
            <span>Oscillation Mode</span>
            <UIcon :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4 text-(--text-muted)" />
        </button>

        <div
            class="flex flex-col gap-5 transition-all duration-500 ease-(--motion-ease-out)"
            :class="open ? 'max-h-[64rem] pt-3.5' : 'max-h-0 overflow-hidden opacity-0'"
            :inert="!open"
        >
            <RadioGroup v-model="mode" color="primary" :items="oscillationItems" size="lg" />
        </div>
    </div>
</template>
