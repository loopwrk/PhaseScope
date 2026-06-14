<script setup lang="ts">
import Logo from '../components/ds/Logo.vue';
import IconButton from '../components/ds/IconButton.vue';

// Segmented-control treatment shared with the HUD (ControlsOverlay)
import { segActive, segBaseMd as segBase, segIdle } from '../components/ds/segmented';

useSeoMeta({
    title: 'Influences - PhaseScope',
    description:
        "The thinkers and artists PhaseScope grew from: Éliane Radigue's oscillator drones, cymatics and visible sound, Helmholtz on consonance, Ryoji Ikeda's sonification of data, Floris Takens' delay-embedding theorem, David Bohm's implicate order, and Spencer-Brown and Kauffman's Laws of Form.",
});

interface Influence {
    name?: string;
    work: string;
    text: string;
    // Closest-correlating source for the idea described above, and the
    // human-readable label it reads as on the page.
    href: string;
    hrefAudio?: string;
    source: string;
    sourceAudio?: string;
}

// The minds the project grew from
const seedInfluences: Influence[] = [
    {
        name: 'Éliane Radigue',
        work: 'Trilogie de la Mort',
        text: "Radigue's music moves so slowly that listening dissolves into inhabiting; her tones are spaces you stay inside. Rather than playing notes or sequences, she would set up extremely delicate configurations of oscillators and let them produce slowly evolving drones. When two oscillators are tuned very close together but not identical, their waveforms drift in and out of phase with each other. When the peaks align, they reinforce (constructive interference); when theyre opposed, they cancel (destructive interference). The result is a slow, periodic swelling and fading — beating — whose rate equals the difference between the two frequencies.",
        href: 'https://en.wikipedia.org/wiki/%C3%89liane_Radigue',
        hrefAudio: 'https://xirecords.bandcamp.com/album/trilogie-de-la-mort',
        source: "Éliane Radigue's synthesis techniques | Stromkult",
        sourceAudio: 'Listen on Bandcamp',
    },

    {
        work: 'Cymatics',
        text: "Cymatics is the study of visible sound - the science of how frequencies sculpt matter into geometric patterns. When you vibrate a substrate like a metal plate or stretched membrane scattered with sand, the grains drift from the areas of greatest movement and settle along the still nodal lines, forming intricate symmetrical shapes. The effect is driven by resonance: every plate has natural frequencies fixed by its size, thickness, stiffness, and clamping (these are the technical terms, don't come at me!). When the driving tone matches a frequency, the surface locks into a standing wave. That wave divides the surface into antinodes, which flex at maximum amplitude, and motionless nodes - so the energetic antinodes keep kicking the grains until they tumble into a quiet node and settle. A higher resonant frequency excites a higher-order mode with more nodal lines, which is why the figures grow more elaborate as the pitch climbs.",
        href: 'https://cymascope.com/cymatics-intro/',
        source: 'Cymatics: A short introduction | Cymascope',
    },
    {
        name: 'Hermann von Helmholtz',
        work: 'On the Sensations of Tone',
        text: 'The physics of why consonance (stability and pleasantness produced when two or more notes sounded together blend smoothly) is geometry: the intervals that sound sweetest are precisely the frequency ratios that draw the simplest figures.',
        href: 'https://sensationsoftone.com/',
        source: 'On the Sensations of Tone - Interactive Online Version',
    },
    {
        name: 'Ryoji Ikeda',
        work: 'Data, Phase and the Audibility of Information',
        text: "Ikeda's work strips sound down to its most elemental ingredients: frequency, phase, interference and number. Through installations built from sine waves, pulses and streams of data, he makes the hidden architecture of signals directly perceptible. Where music often conceals its machinery, Ikeda exposes it, revealing that information itself possesses rhythm, texture and form.",
        href: 'https://forma.org.uk/projects/datamatics',
        source: 'Datamatics | Forma',
    },
    {
        name: 'Floris Takens',
        work: 'The delay embedding theorem, 1981',
        text: "Takens showed that a single measured signal can contain traces of the hidden dynamics that generated it. By constructing delayed copies of the signal and plotting them against one another, one can reconstruct a phase space topologically equivalent to the system's original attractor, revealing dimensions that are not directly observed.",
        href: 'https://complexity-methods.github.io/book/psr.html',
        source: 'Phase Space Reconstruction | Complex Systems Approach',
    },
];

// Close = the back button: return wherever the reader came from. Direct
// visits (no in-app history) fall back to the scope itself.
const router = useRouter();
const close = () => {
    if (window.history.length > 1) router.back();
    else router.push('/phasescope');
};
</script>

<template>
    <!-- Column measure per Baymard (50-75 chars/line, ~34em guideline):
         31em at the 14px body size measures ~73 characters per line. -->
    <main class="min-h-svh bg-(--bg) px-6 py-14 text-(--text) md:py-20">
        <div class="mx-auto flex w-full max-w-[31em] flex-col gap-12">
            <div class="flex items-center justify-between gap-4">
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
                <IconButton icon="i-lucide-x" variant="ghost" aria-label="Close and go back" @click="close" />
            </div>

            <!-- Page sections: real navigation between /about and /influences,
                 so each has its own URL, title and meta for SEO. -->
            <nav aria-label="Page section" class="flex flex-wrap gap-1.5">
                <NuxtLink :to="'/about'" :class="[segBase, segIdle]">About</NuxtLink>
                <span :class="[segBase, segActive]" aria-current="page">Influences</span>
            </nav>

            <section class="flex flex-col gap-7">
                <h1 class="font-display text-display font-semibold tracking-display">Influences</h1>
                <p class="text-body leading-(--line-height-normal)">
                    PhaseScope did not begin as a programming exercise. It grew out of a long interest in what listening
                    actually is - and the people below shaped both the question and the instrument built to ask it.
                </p>
                <div v-for="inf in seedInfluences" :key="inf.work" class="flex flex-col gap-2">
                    <h2 class="font-display text-body font-semibold">
                        <span v-if="inf.name">{{ inf.name }} - </span>
                        <span v-if="inf.name" class="font-normal text-(--text-muted)">{{ inf.work }}</span>
                        <span v-if="!inf.name">{{ inf.work }}</span>
                    </h2>
                    <p class="text-body leading-(--line-height-normal) text-(--text-muted)">{{ inf.text }}</p>
                    <a
                        :href="inf.href"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="mt-1 w-fit font-display text-detail font-semibold text-(--accent) no-underline hover:underline focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                    >
                        {{ inf.source }} <span aria-hidden="true">&#8599;</span>
                        <span class="sr-only">(opens in a new tab)</span>
                    </a>
                    <a
                        v-if="inf.hrefAudio"
                        :href="inf.hrefAudio"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="mt-1 w-fit font-display text-detail font-semibold text-(--accent) no-underline hover:underline focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                    >
                        {{ inf.sourceAudio }} <span aria-hidden="true">&#8599;</span>
                        <span class="sr-only">(opens in a new tab)</span>
                    </a>
                </div>
            </section>
        </div>
    </main>
</template>
