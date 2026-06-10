<script setup lang="ts">
/* DisplayPanel - the "Display Settings" panel: resolution + coverage sliders,
   topology + render-mode radios, toggles, expandable advanced options, and a
   performance warning. Composes the DS primitives; local state for the demo. */
import { ref } from 'vue';
import Panel from '../ds/Panel.vue';
import Slider from '../ds/Slider.vue';
import RadioGroup from '../ds/RadioGroup.vue';
import Switch from '../ds/Switch.vue';
import Button from '../ds/Button.vue';

const pointsPerFrame = ref(512);
const coverage = ref(65);
const topology = ref<string | number>('corridor');
const renderMode = ref<string | number>('points');
const oscillate = ref(false);
const reverse = ref(false);
const advanced = ref(false);
const handedBias = ref(0);

const topologyItems = [
    { label: 'Corridor', value: 'corridor' },
    { label: 'Sphere', value: 'sphere' },
    { label: 'Attractor', value: 'attractor' },
];
const renderItems = [
    { label: 'Points', value: 'points' },
    { label: 'Lines', value: 'lines' },
];
</script>

<template>
    <Panel variant="elevated" class="flex w-80 flex-col gap-5">
        <p class="font-display text-heading">Display Settings</p>

        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
                <span class="ps-label">Points per frame</span>
                <span class="font-mono text-detail text-(--text) tabular-nums">{{ pointsPerFrame }}</span>
            </div>
            <Slider v-model="pointsPerFrame" :min="32" :max="512" :step="32" />
        </div>

        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
                <span class="ps-label">Track coverage</span>
                <span class="font-mono text-detail text-(--text) tabular-nums">{{ coverage }}%</span>
            </div>
            <Slider v-model="coverage" :min="10" :max="100" />
            <p v-if="coverage > 90" class="ps-label text-(--warning)">High point budget may impact performance.</p>
        </div>

        <div class="flex flex-col gap-2">
            <span class="ps-label">Topology</span>
            <RadioGroup v-model="topology" :items="topologyItems" orientation="horizontal" />
        </div>

        <div class="flex flex-col gap-2">
            <span class="ps-label">Render mode</span>
            <RadioGroup v-model="renderMode" :items="renderItems" orientation="horizontal" />
        </div>

        <div class="flex flex-col gap-3">
            <label class="flex items-center justify-between">
                <span class="text-detail">Point oscillation</span>
                <Switch v-model="oscillate" />
            </label>
            <label class="flex items-center justify-between">
                <span class="text-detail">Reverse colour spectrum</span>
                <Switch v-model="reverse" />
            </label>
        </div>

        <Button
            variant="ghost"
            :label="advanced ? 'Hide Advanced Options' : 'Show Advanced Options'"
            @click="advanced = !advanced"
        />

        <div v-if="advanced" class="flex flex-col gap-2 border-t border-(--border) pt-4">
            <div class="flex items-center justify-between">
                <span class="ps-label">Narrative handed bias</span>
                <span class="font-mono text-detail text-(--text) tabular-nums">{{ handedBias }}</span>
            </div>
            <Slider v-model="handedBias" :min="-100" :max="100" />
        </div>
    </Panel>
</template>
