<script setup lang="ts">
/* AdvancedPanel - collapsible "Advanced options": the oscillation mode and the
   experimental narrative-visualisation transform (stage / chirality / auto-stage).
   Controlled: every setting is a v-model and the parent owns the engine state. */
import Panel from '../ds/Panel.vue';
import IconButton from '../ds/IconButton.vue';
import Badge from '../ds/Badge.vue';
import RadioGroup from '../ds/RadioGroup.vue';
import Slider from '../ds/Slider.vue';
import Switch from '../ds/Switch.vue';

withDefaults(defineProps<{ variant?: 'solid' | 'glass' | 'elevated' }>(), { variant: 'elevated' });

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
    <Panel :variant="variant" class="flex w-full max-w-[20rem] flex-col gap-4">
        <div class="flex items-center justify-between">
            <p class="font-display text-heading">Advanced options</p>
            <IconButton
                :icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                variant="ghost"
                size="sm"
                :aria-label="open ? 'Collapse advanced options' : 'Expand advanced options'"
                @click="open = !open"
            />
        </div>

        <div
            class="flex flex-col gap-5 transition-all duration-500 ease-(--motion-ease-out)"
            :class="open ? 'max-h-[64rem]' : 'max-h-0 overflow-hidden opacity-0'"
        >
            <!-- Oscillation mode -->
            <div class="flex flex-col gap-2">
                <span class="ps-label">Oscillation mode</span>
                <RadioGroup v-model="mode" :items="oscillationItems" />
            </div>

            <!-- Narrative visualisation (experimental) -->
            <div class="flex flex-col gap-4 border-t border-(--border) pt-4">
                <label class="flex items-start justify-between gap-3">
                    <span class="flex flex-col gap-1">
                        <span class="inline-flex items-center gap-2 text-detail">
                            Narrative visualisation
                            <Badge color="warning" variant="outline" label="Experimental" />
                        </span>
                        <span class="text-detail text-(--text-muted)"
                            >Layers a staged transform over the audio geometry.</span
                        >
                    </span>
                    <Switch v-model="narrative" />
                </label>

                <div class="flex flex-col gap-4" :class="{ 'pointer-events-none opacity-40': !narrative }">
                    <div v-if="narrative && !autoStage" class="flex flex-col gap-2">
                        <span class="ps-label">Stage</span>
                        <RadioGroup v-model="stage" :items="stageItems" :disabled="!narrative" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex items-center justify-between">
                            <span class="ps-label">Chirality bias</span>
                            <span class="font-mono text-detail text-(--text) tabular-nums">{{
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
    </Panel>
</template>
