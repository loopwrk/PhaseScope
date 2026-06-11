<script setup lang="ts">
/* AdvancedPanel - the collapsible "Advanced Options" disclosure that lives at
   the foot of the Display Settings panel (slotted via DisplayPanel's #advanced
   slot, like the design comp). Holds the oscillation mode selector.
   Controlled: every setting is a v-model and the parent owns the engine state. */
import RadioGroup from '../ds/RadioGroup.vue';

const open = defineModel<boolean>('open', { default: false });
const mode = defineModel<string | number>('mode', { default: 'wave' });

const oscillationItems = [
    {
        label: 'Wave',
        value: 'wave',
        description:
            'Loudness as a ripple propagating through the structure. Oscillates at a fixed visible speed; intensity tracks amplitude.',
    },
    {
        label: 'Per-point',
        value: 'per-point',
        description: 'Local frequency content. Each point oscillates at its own rate, derived from the audio there.',
    },
    {
        label: 'Per-frame',
        value: 'per-frame',
        description:
            'Average frequency per frame. Points in a frame move together - bass-heavy moments slower, treble faster.',
    },
];
</script>

<template>
    <div class="mt-5 border-t border-(--border)">
        <button
            type="button"
            class="flex w-full items-center justify-between gap-2 pb-1 pt-3 font-display text-detail font-semibold transition-[box-shadow] duration-150 focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
            :aria-expanded="open"
            @click="open = !open"
        >
            <span>Advanced Options</span>
            <UIcon :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4 text-(--text-muted)" />
        </button>

        <div
            class="flex flex-col gap-5 transition-all duration-500 ease-(--motion-ease-out)"
            :class="open ? 'max-h-[64rem] pt-3.5' : 'max-h-0 overflow-hidden opacity-0'"
            :inert="!open"
        >
            <div class="flex flex-col gap-2.5">
                <span class="font-display text-detail font-semibold text-(--accent)">Oscillation Mode</span>
                <RadioGroup v-model="mode" :items="oscillationItems" size="lg" />
            </div>
        </div>
    </div>
</template>
