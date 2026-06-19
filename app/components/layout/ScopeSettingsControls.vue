<script setup lang="ts">
import RadioGroup from '../ds/RadioGroup.vue';
import Slider from '../ds/Slider.vue';
import Checkbox from '../ds/Checkbox.vue';

const dimension = defineModel<'3d' | '2d'>('dimension', { default: '3d' });
const lineWidth = defineModel<number>('lineWidth', { default: 1 });
const colourMode = defineModel<'spectrum' | 'average' | 'custom'>('colourMode', { default: 'spectrum' });
const customColour = defineModel<string>('customColour', { default: '#2fd4e6' });
const waveform = defineModel<boolean>('waveform', { default: false });

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
            <RadioGroup v-model="dimension" color="primary" :items="dimensionItems" orientation="horizontal" />
        </div>

        <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-2">
                <span class="font-display text-detail font-medium">Line Thickness</span>
                <span class="font-mono text-detail tracking-label text-(--accent) tabular-nums">{{ lineWidth }}px</span>
            </div>
            <Slider v-model="lineWidth" :min="1" :max="6" :step="1" />
        </div>

        <label class="flex items-center gap-3">
            <Checkbox v-model="waveform" size="lg" />
            <span class="flex flex-col">
                <span class="text-detail">Waveform overlay</span>
                <span class="text-caption text-(--text-muted)">Time across the cube, amplitude on Y.</span>
            </span>
        </label>

        <div class="flex flex-col gap-2.5">
            <span class="font-display text-detail font-semibold text-(--accent)">Colour</span>
            <RadioGroup v-model="colourMode" color="primary" :items="colourItems" />
            <div v-if="colourMode === 'custom'" class="pt-1">
                <UColorPicker v-model="customColour" format="hex" size="sm" aria-label="Custom trail colour" />
            </div>
        </div>
    </div>
</template>
