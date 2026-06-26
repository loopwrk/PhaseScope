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
import Checkbox from '../ds/Checkbox.vue';
import KeyCap from '../ds/KeyCap.vue';
import IconButton from '../ds/IconButton.vue';
import { LIVE_VOICES, LIVE_VOICE_IDS, type LiveVoiceId } from '~/utils/liveVoices';
import { computed } from 'vue';

withDefaults(
    defineProps<{
        /** Live session active: hide track-only sections (points budget,
         *  coverage, perf warning, topology - the session card owns those) */
        live?: boolean;
        wavLoaded?: boolean;
        settingsDisabled?: boolean; // points / coverage (disabled while playing or unloaded)
        topologyDisabled?: boolean; // topology (disabled while playing)
        perfLevel?: 'none' | 'warning' | 'danger';
        perfPoints?: string;
        variant?: 'solid' | 'glass' | 'elevated';
    }>(),
    {
        live: false,
        wavLoaded: false,
        settingsDisabled: false,
        topologyDisabled: false,
        perfLevel: 'none',
        perfPoints: '',
        variant: 'elevated',
    }
);

defineEmits<{ close: [] }>();

const pointsPerFrame = defineModel<number>('pointsPerFrame', { default: 512 });
const coverage = defineModel<number>('coverage', { default: 100 });
const renderMode = defineModel<string | number>('renderMode', { default: 'points' });
const topology = defineModel<string | number>('topology', { default: 'corridor' });
const oscillation = defineModel<boolean>('oscillation', { default: false });
const background = defineModel<string | number>('background', { default: 'starfield' });

const backgroundItems = [
    { label: 'None', value: 'none' },
    { label: 'Starfield', value: 'starfield' },
    { label: 'Dream', value: 'dream' },
];

const liveVoice = defineModel<LiveVoiceId>('liveVoice', { default: 'pure' });
// RadioGroup speaks string | number; this proxy keeps the model typed
const liveVoiceProxy = computed<string | number>({
    get: () => liveVoice.value,
    set: (v) => (liveVoice.value = v as LiveVoiceId),
});
// Description rides on the selected voice only, like the topology list
const voiceItems = computed(() =>
    LIVE_VOICE_IDS.map((id) => ({
        label: LIVE_VOICES[id].label,
        value: id,
        description: liveVoice.value === id ? LIVE_VOICES[id].hint : undefined,
    }))
);

const renderItems = computed(() => [
    { label: 'Points', value: 'points' },
    { label: 'Lines', value: 'lines' },
]);
const topologyLabels: Record<string, string> = {
    corridor: 'Corridor',
    sphere: 'Sphere',
    attractor: 'Attractor',
    mobius: 'Möbius',
    poincare: 'Poincaré',
    harmonics: 'Harmonics',
    knot: 'Knot',
    helix: 'Double Helix',
    hopf: 'Hopf Fibration',
};
const topologyDescriptions: Record<string, string> = {
    corridor: 'Time unfolds along the Z-axis as a traversable tunnel.',
    sphere: 'Audio wraps around a sphere from north to south pole.',
    attractor: 'Audio traces a Lorenz strange attractor - amplitude drives the chaos parameter.',
    mobius: 'Time loops a half-twisted band - the end of the track arrives as the mirror of its beginning.',
    poincare: 'The stereo field as light polarization, traced on the Poincaré sphere - poles are quadrature circles, the equator in/anti-phase, the centre decorrelation.',
    harmonics: 'A vibrating-sphere bloom - pitch sets the number of lobes, loudness their depth. Higher notes grow more intricate.',
    knot: 'A torus knot whose woundness is the harmonic richness of the track - simple sounds make simple knots, busy ones tangle.',
    helix: 'A DNA double helix - pitch winds the strands, the stereo image bows each base-pair rung, and the stereo field is sequenced into four colours (A/C/G/T).',
    hopf: 'The stereo state lifted off the Poincaré/Bloch sphere - each moment becomes a linked ring (a Hopf fibre), and the track threads them into nested, interlocking circles.',
};
// Kept in the engine but withheld from the picker: Poincaré is superseded by the
// Hopf fibration that lifts it, and the double helix is parked. Their labels and
// descriptions stay above so the active-topology badge still names them if they
// are selected by other means (e.g. a persisted setting).
const HIDDEN_TOPOLOGIES = new Set(['poincare', 'helix']);
// Description rides on the selected option only, like the comp.
const topologyItems = computed(() =>
    Object.keys(topologyLabels)
        .filter((value) => !HIDDEN_TOPOLOGIES.has(value))
        .map((value) => ({
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
            <div class="flex items-center gap-2">
                <Badge color="primary" size="xl" :label="topologyLabel" />
                <IconButton
                    icon="i-lucide-x"
                    variant="ghost"
                    class="mr-0"
                    size="sm"
                    aria-label="Hide settings"
                    @click="$emit('close')"
                />
            </div>
        </template>

        <div class="grid gap-x-7 gap-y-5 sm:grid-cols-2">
            <div class="flex flex-col gap-5">
                <!-- Points per frame -->
                <div
                    v-if="!live"
                    class="flex flex-col gap-2"
                    :class="{ 'pointer-events-none opacity-40': settingsDisabled }"
                >
                    <div class="flex items-baseline justify-between gap-2">
                        <span class="font-display text-label font-medium text-(--brand-secondary)"
                            >Points Per Frame</span
                        >
                        <span class="font-mono text-detail tracking-label text-(--brand-secondary) tabular-nums">{{
                            pointsPerFrame
                        }}</span>
                    </div>
                    <Slider v-model="pointsPerFrame" :min="16" :max="640" :step="16" :disabled="settingsDisabled" />
                </div>

                <!-- Track coverage -->
                <div
                    v-if="!live"
                    class="flex flex-col gap-2"
                    :class="{ 'pointer-events-none opacity-40': settingsDisabled }"
                >
                    <div class="flex items-baseline justify-between gap-2">
                        <span class="font-display text-label font-medium text-(--brand-secondary)">Track Coverage</span>
                        <span class="font-mono text-detail tracking-label text-(--brand-secondary) tabular-nums">
                            {{ coverage }}%<template v-if="wavLoaded && perfPoints">
                                &middot; {{ perfPoints }}</template
                            >
                        </span>
                    </div>
                    <Slider v-model="coverage" :min="10" :max="100" :step="5" :disabled="settingsDisabled" />
                </div>

                <!-- Performance warning -->
                <div
                    v-if="!live && wavLoaded && perfLevel !== 'none'"
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
                    <span
                        class="inline-flex items-center gap-2 font-display text-label font-semibold text-(--brand-secondary)"
                        >Render Mode <KeyCap label="R"
                    /></span>
                    <RadioGroup
                        v-model="renderMode"
                        :items="renderItems"
                        orientation="horizontal"
                        size="xl"
                        color="primary"
                    />
                </div>

                <!-- Background skybox -->
                <div class="flex flex-col gap-3">
                    <span class="font-display text-label font-semibold text-(--brand-secondary)">Background</span>
                    <RadioGroup v-model="background" :items="backgroundItems" size="xl" color="primary" />
                </div>
            </div>

            <div class="flex flex-col gap-5">
                <!-- Topology (live: chosen in the session card instead) -->
                <div
                    v-if="!live"
                    class="flex flex-col gap-2.5"
                    :class="{ 'pointer-events-none opacity-40': topologyDisabled }"
                >
                    <span class="font-display text-label font-semibold text-(--brand-secondary)">Topology</span>
                    <RadioGroup
                        v-model="topology"
                        color="primary"
                        :items="topologyItems"
                        :disabled="topologyDisabled"
                        size="xl"
                    />
                </div>

                <!-- Toggles -->
                <div class="flex flex-col gap-3">
                    <label class="flex items-center gap-3">
                        <Checkbox v-model="oscillation" size="xl" color="primary" />
                        <span class="inline-flex items-center gap-2 text-detail"
                            >Enable Point Oscillation <KeyCap label="O"
                        /></span>
                    </label>
                </div>

                <!-- Voice (live sessions): the synth's brush - new notes
                     take the new preset, held notes finish in the old one -->
                <div v-if="live" class="flex flex-col gap-2.5">
                    <span class="font-display text-detail font-semibold text-(--accent)">Voice</span>
                    <RadioGroup v-model="liveVoiceProxy" :items="voiceItems" size="lg" />
                </div>
            </div>
        </div>

        <!-- Advanced options disclosure (in-panel, like the comp) -->
        <slot name="advanced" />
    </Panel>
</template>
