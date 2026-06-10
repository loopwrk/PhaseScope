<script setup lang="ts">
/* DisplayPanel - the "Display Settings" panel. Controlled: the parent owns
   the engine state; every setting is a v-model and the disabled / perf-warning
   info comes in as props. (The separate "Advanced options" section stays in
   the page for now.) */
import Panel from '../ds/Panel.vue';
import Slider from '../ds/Slider.vue';
import RadioGroup from '../ds/RadioGroup.vue';
import Switch from '../ds/Switch.vue';
import KeyCap from '../ds/KeyCap.vue';

withDefaults(
    defineProps<{
        wavLoaded?: boolean;
        settingsDisabled?: boolean; // points / coverage (disabled while playing or unloaded)
        topologyDisabled?: boolean; // topology (disabled while playing)
        perfLevel?: 'none' | 'warning' | 'danger';
        perfPoints?: string;
    }>(),
    { wavLoaded: false, settingsDisabled: false, topologyDisabled: false, perfLevel: 'none', perfPoints: '' }
);

const pointsPerFrame = defineModel<number>('pointsPerFrame', { default: 512 });
const coverage = defineModel<number>('coverage', { default: 100 });
const renderMode = defineModel<string | number>('renderMode', { default: 'points' });
const topology = defineModel<string | number>('topology', { default: 'corridor' });
const oscillation = defineModel<boolean>('oscillation', { default: false });
const reverse = defineModel<boolean>('reverse', { default: false });
const dream = defineModel<boolean>('dream', { default: false });
const heavenly = defineModel<boolean>('heavenly', { default: false });
const controlsOverlay = defineModel<boolean>('controlsOverlay', { default: true });

const renderItems = [
    { label: 'Points', value: 'points' },
    { label: 'Lines', value: 'lines' },
];
const topologyItems = [
    { label: 'Corridor', value: 'corridor' },
    { label: 'Sphere', value: 'sphere' },
    { label: 'Attractor', value: 'attractor' },
];
</script>

<template>
    <Panel variant="elevated" class="flex w-80 flex-col gap-5">
        <p class="font-display text-heading">Display Settings</p>

        <!-- Points per frame -->
        <div class="flex flex-col gap-2" :class="{ 'pointer-events-none opacity-40': settingsDisabled }">
            <div class="flex items-center justify-between">
                <span class="ps-label">Points per frame</span>
                <span class="font-mono text-detail text-(--text) tabular-nums">{{ pointsPerFrame }}</span>
            </div>
            <Slider v-model="pointsPerFrame" :min="32" :max="512" :step="32" :disabled="settingsDisabled" />
        </div>

        <!-- Track coverage -->
        <div class="flex flex-col gap-2" :class="{ 'pointer-events-none opacity-40': settingsDisabled }">
            <div class="flex items-center justify-between">
                <span class="ps-label">Track coverage</span>
                <span class="font-mono text-detail text-(--text) tabular-nums">
                    {{ coverage }}%<template v-if="wavLoaded && perfPoints"> &middot; {{ perfPoints }} pts</template>
                </span>
            </div>
            <Slider v-model="coverage" :min="10" :max="100" :step="5" :disabled="settingsDisabled" />
            <p v-if="!wavLoaded" class="text-detail text-(--text-faint)">Load audio to enable this setting.</p>
        </div>

        <!-- Performance warning -->
        <div
            v-if="wavLoaded && perfLevel !== 'none'"
            class="flex flex-col gap-1 border-l-2 p-3 [clip-path:var(--clip-notch)]"
            :class="
                perfLevel === 'danger' ? 'border-(--error) bg-(--error-soft)' : 'border-(--warning) bg-(--warning-soft)'
            "
        >
            <span class="ps-label" :class="perfLevel === 'danger' ? 'text-(--error)' : 'text-(--warning)'">
                {{ perfLevel === 'danger' ? 'High performance risk' : 'Performance warning' }}
            </span>
            <span class="text-detail text-(--text-muted)">
                {{ perfPoints }} points may
                {{ perfLevel === 'danger' ? 'cause significant lag or crashes' : 'impact performance' }} on some
                devices. Reduce track coverage or points per frame.
            </span>
        </div>

        <!-- Render mode -->
        <div class="flex flex-col gap-2">
            <span class="ps-label inline-flex items-center gap-2">Render mode <KeyCap label="R" /></span>
            <RadioGroup v-model="renderMode" :items="renderItems" orientation="horizontal" />
        </div>

        <!-- Topology -->
        <div class="flex flex-col gap-2" :class="{ 'pointer-events-none opacity-40': topologyDisabled }">
            <span class="ps-label">Topology</span>
            <RadioGroup
                v-model="topology"
                :items="topologyItems"
                orientation="horizontal"
                :disabled="topologyDisabled"
            />
            <p class="text-detail text-(--text-muted)">
                <span v-if="topology === 'corridor'">Time unfolds along the Z-axis as a traversable tunnel.</span>
                <span v-else-if="topology === 'sphere'">Audio wraps around a sphere from north to south pole.</span>
                <span v-else>Audio traces a Lorenz strange attractor - amplitude drives the chaos parameter.</span>
            </p>
        </div>

        <!-- Toggles -->
        <div class="flex flex-col gap-3 border-t border-(--border) pt-4">
            <label class="flex items-center justify-between">
                <span class="inline-flex items-center gap-2 text-detail">Point oscillation <KeyCap label="O" /></span>
                <Switch v-model="oscillation" />
            </label>
            <label class="flex items-center justify-between">
                <span class="inline-flex items-center gap-2 text-detail"
                    >Reverse colour spectrum <KeyCap label="V"
                /></span>
                <Switch v-model="reverse" />
            </label>
            <label class="flex items-center justify-between">
                <span class="inline-flex items-center gap-2 text-detail">Dream background <KeyCap label="B" /></span>
                <Switch v-model="dream" />
            </label>
            <label class="flex items-center justify-between">
                <span class="inline-flex items-center gap-2 text-detail">Heavenly background <KeyCap label="N" /></span>
                <Switch v-model="heavenly" />
            </label>
            <label class="flex items-center justify-between">
                <span class="inline-flex items-center gap-2 text-detail"
                    >Show controls overlay <KeyCap label="H"
                /></span>
                <Switch v-model="controlsOverlay" />
            </label>
        </div>
    </Panel>
</template>
