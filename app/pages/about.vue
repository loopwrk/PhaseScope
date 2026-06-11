<script setup lang="ts">
import Logo from '../components/ds/Logo.vue';
import type { TopologyMode } from '~/composables/usePhaseGeometry.client';

useSeoMeta({
    title: 'About — PhaseScope',
    description:
        'What PhaseScope is and how it works: a real-time 3D audio visualiser that renders stereo sound as explorable phase-space geometry - a corridor, sphere, Lorenz attractor or Möbius band built from the music itself.',
});

interface TopologyCopy {
    id: TopologyMode;
    label: string;
    paragraphs: string[];
}

const topologies: TopologyCopy[] = [
    {
        id: 'corridor',
        label: 'Corridor',
        paragraphs: [
            'The straight road: time runs along one axis. Each window of audio becomes a ring of points - the phase portrait wrapped around a circular spine - and the rings stack one behind another at a fixed spacing, building a tunnel as the track plays. The near rings are the present; the far ones are the opening bars. Flying down the corridor is scrubbing through time with your body.',
            'The music shapes every ring. Stereo width sets the flare - a mono passage tightens the ring toward a thin blade, a wide mix blooms it into a full wreath - while loudness brightens the points and tonal content colours them, bass glowing blue-violet, treble running to red.',
        ],
    },
    {
        id: 'sphere',
        label: 'Sphere',
        paragraphs: [
            'Time becomes latitude. The first window of audio sits at the north pole, the last arrives at the south, and everything in between wraps the globe ring by ring. A whole track becomes a planet you can orbit: the first half of the song is the northern hemisphere.',
            'Here the music works as terrain. Each point is pushed outward from the surface in proportion to loudness - quiet passages hug the sphere, loud ones raise mountain ranges out of it - so a chorus reads as a band of high relief and a breakdown as a smooth latitude. Colour and brightness follow tone and amplitude as everywhere else.',
        ],
    },
    {
        id: 'attractor',
        label: 'Attractor',
        paragraphs: [
            'Audio steers a storm. Before drawing anything, PhaseScope integrates a Lorenz system - the strange attractor of chaos theory, the butterfly - using the track’s own loudness envelope to push the chaos parameter ρ between 25 and 38. Loud sections drive the trajectory across the divide between the butterfly’s two lobes; quiet ones let it settle into circling a single wing.',
            'The geometry is a tube around that trajectory: each window of audio forms the tube’s cross-section, breathing wider with amplitude. Chaos here is deterministic - the same song always draws the same storm - but no two songs ever draw the same one.',
        ],
    },
    {
        id: 'mobius',
        label: 'Möbius',
        paragraphs: [
            'Time loops once around a band with a half-twist in it. Each window’s phase portrait is the band’s cross-section, and as the track progresses the cross-section slowly turns - a quarter-turn by the halfway mark, a half-turn by the end.',
            'The consequence is the Möbius band’s old trick. The track’s final moments arrive back where it began, but mirrored: the portrait of the ending is the polarity-inverse of the opening. On a non-orientable surface there is no consistent left or right - a fitting place to draw a stereo signal. The music returns to where it started, but it cannot return as itself.',
        ],
    },
];

const activeTopology = ref<TopologyMode>('corridor');

// "Walk through it" opens the scope in the topology being read: the
// settings live in useState (useScopeSettings), so setting the mode here
// carries across the client-side navigation.
const { topologyMode } = useScopeSettings();
const launchActiveTopology = () => {
    topologyMode.value = activeTopology.value;
};

// Segmented-control treatment shared with the HUD (ControlsOverlay)
const segBase =
    'rounded-none border px-3 py-1.5 font-mono text-caption uppercase tracking-label transition-[transform,box-shadow,color] duration-150 [clip-path:var(--clip-chamfer-sm)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow) active:translate-y-px';
const segActive = 'border-(--accent) text-(--accent) shadow-(--shadow-glow-accent)';
const segIdle = 'border-(--border-strong) text-(--text-muted) hover:text-(--text)';
</script>

<template>
    <!-- Column measure per Baymard (50-75 chars/line, ~34em guideline):
         31em at the 14px body size measures ~73 characters per line. -->
    <main class="min-h-svh bg-(--bg) px-6 py-14 text-(--text) md:py-20">
        <div class="mx-auto flex w-full max-w-[31em] flex-col gap-12">
            <NuxtLink
                to="/phasescope"
                class="inline-flex w-fit items-center gap-3 text-(--text) no-underline hover:no-underline focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                aria-label="Back to the visualiser"
            >
                <Logo :size="34" class="shrink-0" />
                <span class="font-display text-title font-semibold leading-none tracking-display">
                    Phase<span class="text-(--accent)">Scope</span>
                </span>
            </NuxtLink>

            <!-- gap-7 = 28px, roughly the 2em paragraph spacing the article suggests -->
            <section class="flex flex-col gap-7">
                <h1 class="font-display text-display font-semibold tracking-display">About PhaseScope</h1>

                <p class="text-body leading-(--line-height-normal)">
                    PhaseScope turns a piece of music into a place you can fly through. Most visualisers draw a picture
                    of the sound and replace it moment by moment; PhaseScope keeps every moment. As a track plays, each
                    instant of sound becomes a slice of glowing points, and the slices accumulate into a structure - a
                    tunnel, a planet, a storm, a twisted band - that you can orbit, enter and explore. Loud passages
                    bloom wide and bright, quiet ones draw thin; colour follows tone, with bass glowing blue-violet and
                    treble running to red. By the end of the track, the whole piece of music is standing in front of you
                    as a single shape.
                </p>

                <p class="text-body leading-(--line-height-normal) text-(--text-muted)">
                    More precisely, PhaseScope is a phase-space instrument. A stereo signal is two synchronised streams
                    of amplitude, left and right. Take them as the x and y coordinates of a single moving point and you
                    get a phase portrait - the Lissajous figure of oscilloscope tradition. A mono signal collapses onto
                    a diagonal line, a wide mix opens into a broad figure, and anti-phase material leans along the
                    opposite diagonal; the goniometer in the corner of the scope shows exactly this, live. PhaseScope
                    then extrudes the portrait through time: the audio is sliced into overlapping windows of 2,048
                    samples, each window’s portrait becomes a cross-section of up to 512 points, and successive
                    cross-sections are strung along a path through space. Colour encodes each window’s spectral balance
                    and brightness follows amplitude, so the finished structure is the track’s trajectory through its
                    own state space, rendered as geometry. Where that path goes is the topology’s choice.
                </p>
            </section>

            <section class="flex flex-col gap-5" aria-labelledby="topologies-heading">
                <div class="flex flex-col gap-2">
                    <h2 id="topologies-heading" class="font-display text-title font-semibold tracking-display">
                        The four topologies
                    </h2>
                    <p class="text-body leading-(--line-height-normal) text-(--text-muted)">
                        The same music, four different journeys through space. Choose one to read how it works.
                    </p>
                </div>

                <div role="tablist" aria-label="Topology" class="flex flex-wrap gap-1.5">
                    <button
                        v-for="t in topologies"
                        :key="t.id"
                        :id="`topology-tab-${t.id}`"
                        role="tab"
                        type="button"
                        :aria-selected="activeTopology === t.id"
                        :aria-controls="`topology-panel-${t.id}`"
                        :class="[segBase, activeTopology === t.id ? segActive : segIdle]"
                        @click="activeTopology = t.id"
                    >
                        {{ t.label }}
                    </button>
                </div>

                <!-- All four panels are rendered (v-show) so the full copy is
                     in the server-rendered HTML; only the active one displays. -->
                <div
                    v-for="t in topologies"
                    v-show="activeTopology === t.id"
                    :key="t.id"
                    :id="`topology-panel-${t.id}`"
                    role="tabpanel"
                    :aria-labelledby="`topology-tab-${t.id}`"
                    class="flex flex-col gap-7 border-l-2 border-[color-mix(in_oklch,var(--accent)_40%,transparent)] pl-6"
                >
                    <p
                        v-for="(paragraph, i) in t.paragraphs"
                        :key="i"
                        class="text-body leading-(--line-height-normal)"
                        :class="{ 'text-(--text-muted)': i > 0 }"
                    >
                        {{ paragraph }}
                    </p>
                </div>
            </section>

            <NuxtLink
                to="/phasescope"
                class="mt-2 w-fit font-display text-detail font-semibold text-(--accent) no-underline hover:underline focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                @click="launchActiveTopology"
            >
                Load a track and walk through it &rarr;
            </NuxtLink>
        </div>
    </main>
</template>
