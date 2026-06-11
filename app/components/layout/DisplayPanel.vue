<script setup lang="ts">
/* DisplayPanel - the "Display Settings" panel. Controlled: the parent owns
   the engine state; every setting is a v-model and the disabled / perf-warning
   info comes in as props. Matches the design comp: striated mono header strip
   with the active-topology badge, a two-column body (sliders + render mode |
   topology + toggles), and an #advanced slot for the in-panel disclosure. */
import Panel from '../ds/Panel.vue';
import Badge from '../ds/Badge.vue';
import Slider from '../ds/Slider.vue';
import RadioGroup from '../ds/RadioGroup.vue';
import Switch from '../ds/Switch.vue';
import Checkbox from '../ds/Checkbox.vue';
import KeyCap from '../ds/KeyCap.vue';
import { computed } from 'vue';

withDefaults(
    defineProps<{
        wavLoaded?: boolean;
        settingsDisabled?: boolean; // points / coverage (disabled while playing or unloaded)
        topologyDisabled?: boolean; // topology (disabled while playing)
        perfLevel?: 'none' | 'warning' | 'danger';
        perfPoints?: string;
        variant?: 'solid' | 'glass' | 'elevated';
    }>(),
    {
        wavLoaded: false,
        settingsDisabled: false,
        topologyDisabled: false,
        perfLevel: 'none',
        perfPoints: '',
        variant: 'elevated',
    }
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
const topologyLabels: Record<string, string> = {
    corridor: 'Corridor',
    sphere: 'Sphere',
    attractor: 'Attractor',
    mobius: 'Möbius',
};
const topologyDescriptions: Record<string, string> = {
    corridor: 'Time unfolds along the Z-axis as a traversable tunnel.',
    sphere: 'Audio wraps around a sphere from north to south pole.',
    attractor: 'Audio traces a Lorenz strange attractor - amplitude drives the chaos parameter.',
    mobius: 'Time loops a half-twisted band - the end of the track arrives as the mirror of its beginning.',
};
// Description rides on the selected option only, like the comp.
const topologyItems = computed(() =>
    Object.keys(topologyLabels).map((value) => ({
        label: topologyLabels[value]!,
        value,
        description: topology.value === value ? topologyDescriptions[value] : undefined,
    }))
);
const topologyLabel = computed(() => topologyLabels[String(topology.value)] ?? String(topology.value));
</script>

<template>
    <Panel :variant="variant" title="Display Settings" class="w-full">
        <template #headerRight>
            <Badge color="primary" :label="topologyLabel" />
        </template>

        <div class="grid gap-x-7 gap-y-5 sm:grid-cols-2">
            <div class="flex flex-col gap-5">
                <!-- Points per frame -->
                <div class="flex flex-col gap-2" :class="{ 'pointer-events-none opacity-40': settingsDisabled }">
                    <div class="flex items-baseline justify-between gap-2">
                        <span class="font-display text-detail font-medium">Points Per Frame</span>
                        <span class="font-mono text-detail tracking-label text-(--accent) tabular-nums">{{
                            pointsPerFrame
                        }}</span>
                    </div>
                    <Slider v-model="pointsPerFrame" :min="32" :max="512" :step="32" :disabled="settingsDisabled" />
                </div>

                <!-- Track coverage -->
                <div class="flex flex-col gap-2" :class="{ 'pointer-events-none opacity-40': settingsDisabled }">
                    <div class="flex items-baseline justify-between gap-2">
                        <span class="font-display text-detail font-medium">Track Coverage</span>
                        <span class="font-mono text-detail tracking-label text-(--accent) tabular-nums">
                            {{ coverage }}%<template v-if="wavLoaded && perfPoints">
                                &middot; {{ perfPoints }}</template
                            >
                        </span>
                    </div>
                    <Slider v-model="coverage" :min="10" :max="100" :step="5" :disabled="settingsDisabled" />
                    <p v-if="!wavLoaded" class="text-caption text-(--text-faint)">Load audio to enable this setting.</p>
                </div>

                <!-- Performance warning -->
                <div
                    v-if="wavLoaded && perfLevel !== 'none'"
                    class="flex items-start gap-2.5 border p-3 [clip-path:var(--clip-notch)]"
                    :class="
                        perfLevel === 'danger'
                            ? 'border-(--error)/45 bg-(--error-soft)'
                            : 'border-(--warning)/45 bg-(--warning-soft)'
                    "
                    role="status"
                >
                    <UIcon
                        name="i-lucide-triangle-alert"
                        class="mt-0.5 size-4 shrink-0"
                        :class="perfLevel === 'danger' ? 'text-(--error)' : 'text-(--warning)'"
                    />
                    <div class="flex flex-col gap-0.5">
                        <span
                            class="font-display text-detail font-semibold"
                            :class="perfLevel === 'danger' ? 'text-(--error)' : 'text-(--warning)'"
                        >
                            {{ perfLevel === 'danger' ? 'High performance risk' : 'Performance warning' }}
                        </span>
                        <span class="text-caption leading-(--line-height-normal) text-(--text-muted)">
                            {{ perfPoints }} points may
                            {{ perfLevel === 'danger' ? 'cause significant lag or crashes' : 'impact performance' }}
                            on some devices. Reduce track coverage or points per frame.
                        </span>
                    </div>
                </div>

                <!-- Render mode -->
                <div class="flex flex-col gap-2.5">
                    <span class="inline-flex items-center gap-2 font-display text-detail font-semibold text-(--accent)"
                        >Render Mode <KeyCap label="R"
                    /></span>
                    <RadioGroup v-model="renderMode" :items="renderItems" orientation="horizontal" />
                </div>
            </div>

            <div class="flex flex-col gap-5">
                <!-- Topology -->
                <div class="flex flex-col gap-2.5" :class="{ 'pointer-events-none opacity-40': topologyDisabled }">
                    <span class="font-display text-detail font-semibold text-(--accent)">Topology</span>
                    <RadioGroup v-model="topology" :items="topologyItems" :disabled="topologyDisabled" />
                </div>

                <!-- Toggles -->
                <div class="flex flex-col gap-3">
                    <label class="flex items-center gap-3">
                        <Switch v-model="controlsOverlay" />
                        <span class="inline-flex items-center gap-2 text-detail"
                            >Show Controls Overlay <KeyCap label="H"
                        /></span>
                    </label>
                    <label class="flex items-center gap-3">
                        <Checkbox v-model="oscillation" />
                        <span class="inline-flex items-center gap-2 text-detail"
                            >Enable Point Oscillation <KeyCap label="O"
                        /></span>
                    </label>
                    <label class="flex items-center gap-3">
                        <Checkbox v-model="reverse" />
                        <span class="inline-flex items-center gap-2 text-detail"
                            >Reverse Colour Spectrum <KeyCap label="V"
                        /></span>
                    </label>
                    <label class="flex items-center gap-3">
                        <Checkbox v-model="dream" />
                        <span class="inline-flex items-center gap-2 text-detail"
                            >Dream Background <KeyCap label="B"
                        /></span>
                    </label>
                    <label class="flex items-center gap-3">
                        <Checkbox v-model="heavenly" />
                        <span class="inline-flex items-center gap-2 text-detail"
                            >Heavenly Background <KeyCap label="N"
                        /></span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Advanced options disclosure (in-panel, like the comp) -->
        <slot name="advanced" />
    </Panel>
</template>
