<script setup lang="ts">
/* AdvancedPanel - the collapsible "Advanced Options" disclosure that lives at
   the foot of the Display Settings panel (slotted via DisplayPanel's #advanced
   slot, like the design comp): the oscillation mode and the experimental
   narrative-visualisation transform (stage / chirality / auto-stage).
   Controlled: every setting is a v-model and the parent owns the engine state. */
import Badge from '../ds/Badge.vue';
import RadioGroup from '../ds/RadioGroup.vue';
import Slider from '../ds/Slider.vue';
import Switch from '../ds/Switch.vue';

const open = defineModel<boolean>('open', { default: false });
const mode = defineModel<string | number>('mode', { default: 'wave' });
const narrative = defineModel<boolean>('narrative', { default: false });
const stage = defineModel<string | number>('stage', { default: 'channel-bias' });
const chirality = defineModel<number>('chirality', { default: 0 });
const autoStage = defineModel<boolean>('autoStage', { default: false });

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
const stageItems = [
    { label: 'Channel Bias', value: 'channel-bias' },
    { label: 'Tilt', value: 'tilt' },
    { label: 'Folding', value: 'folding' },
    { label: 'Coils', value: 'coils' },
    { label: 'Stabilization', value: 'stabilization' },
    { label: 'Z-axis scaling', value: 'z-axis-scaling' },
    { label: 'Radial flattening', value: 'radial-flattening' },
    { label: 'Radial scaling', value: 'radial-scaling' },
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
            <!-- Oscillation mode -->
            <div class="flex flex-col gap-2.5">
                <span class="font-display text-detail font-semibold text-(--accent)">Oscillation Mode</span>
                <RadioGroup v-model="mode" :items="oscillationItems" />
            </div>

            <!-- Narrative visualisation (experimental) -->
            <div class="flex flex-col gap-4 border-t border-(--border) pt-4">
                <label class="flex items-start justify-between gap-3">
                    <span class="flex flex-col gap-1">
                        <span class="inline-flex items-center gap-2 text-detail">
                            Narrative Visualisation
                            <Badge color="warning" variant="outline" label="Experimental" />
                        </span>
                        <span class="text-caption text-(--text-muted)"
                            >Layers a staged transform over the audio geometry.</span
                        >
                    </span>
                    <Switch v-model="narrative" />
                </label>

                <div class="flex flex-col gap-4" :class="{ 'pointer-events-none opacity-40': !narrative }">
                    <div v-if="narrative && !autoStage" class="flex flex-col gap-2.5">
                        <span class="font-display text-detail font-semibold text-(--accent)">Stage</span>
                        <RadioGroup v-model="stage" :items="stageItems" :disabled="!narrative" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex items-baseline justify-between gap-2">
                            <span class="font-display text-detail font-medium">Chirality Bias</span>
                            <span class="font-mono text-detail tracking-label text-(--accent) tabular-nums">{{
                                chirality.toFixed(2)
                            }}</span>
                        </div>
                        <Slider v-model="chirality" :min="0" :max="0.8" :step="0.02" :disabled="!narrative" />
                    </div>

                    <label class="flex items-center justify-between gap-3">
                        <span class="text-detail">Auto-stage (driven by build progress)</span>
                        <Switch v-model="autoStage" :disabled="!narrative" />
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>
