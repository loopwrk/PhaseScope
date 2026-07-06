<script setup lang="ts">
import RadioGroup from '../ds/RadioGroup.vue';
import Slider from '../ds/Slider.vue';
import Checkbox from '../ds/Checkbox.vue';
import type { ScopeSettingsModel } from '~/composables/useLissajous3D.client';

// The one place the scope settings are bound to inputs: every surface
// (desktop panel, mobile modal) hands the model straight through.
defineProps<{ model: ScopeSettingsModel }>();

const dimensionItems = [
    { label: '3D', value: '3d', description: 'Takens embedding: z is the mid signal, delayed 6 ms.' },
    { label: '2D', value: '2d', description: 'The flat portrait - the classic XY oscilloscope view.' },
];
const colourItems = [
    {
        label: 'Spectrum',
        value: 'spectrum',
        description: 'Hue follows pitch chroma.',
    },
    {
        label: 'Average',
        value: 'average',
        description: 'Average colour of pitch for the whole figure.',
    },
    { label: 'Custom', value: 'custom', description: 'Single colour (your choice).' },
];
</script>

<template>
    <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-2.5">
            <span class="font-display text-detail font-semibold text-(--accent)">Dimension</span>
            <RadioGroup
                v-model="model.dimension.value"
                color="primary"
                :items="dimensionItems"
                orientation="horizontal"
            />
        </div>

        <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-2">
                <span class="font-display text-detail font-medium">Line Thickness</span>
                <span class="font-mono text-detail tracking-label text-(--accent) tabular-nums"
                    >{{ model.lineWidth.value }}px</span
                >
            </div>
            <Slider v-model="model.lineWidth.value" :min="1" :max="6" :step="1" />
        </div>

        <label class="flex items-center gap-3">
            <Checkbox v-model="model.showWaveform.value" size="lg" />
            <span class="flex flex-col">
                <span class="text-detail">Waveform overlay</span>
                <span class="text-caption text-(--text-muted)">Time across the cube, amplitude on Y.</span>
            </span>
        </label>

        <div class="flex flex-col gap-2.5">
            <span class="font-display text-detail font-semibold text-(--accent)">Colour</span>
            <RadioGroup v-model="model.colourMode.value" color="primary" :items="colourItems" />
            <div v-if="model.colourMode.value === 'custom'" class="pt-1">
                <UColorPicker
                    v-model="model.customColour.value"
                    format="hex"
                    size="sm"
                    aria-label="Custom trail colour"
                />
            </div>
        </div>
    </div>
</template>
