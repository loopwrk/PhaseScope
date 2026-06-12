<script setup lang="ts">
/* TransportBar - floating glass transport dock. Controlled: the parent owns
   the audio/engine state and handlers; this component is presentation + events.
   Matches the design comp: play (brand) + stop (solid) | elapsed readout |
   Load Audio + labelled demo select | playing/paused badge.
     - play/pause + stop (disabled per audioLoaded / started)
     - Load Audio (opens a file picker, emits the chosen File)
     - demo-track select (emits the chosen id)
     - elapsed readout goes scope-magenta "live" while playing */
import { ref } from 'vue';
import IconButton from '../ds/IconButton.vue';
import Button from '../ds/Button.vue';
import Readout from '../ds/Readout.vue';
import Badge from '../ds/Badge.vue';

type TrackItem = { label: string; value: string };

withDefaults(
    defineProps<{
        playing?: boolean;
        audioLoaded?: boolean;
        started?: boolean;
        track?: string;
        elapsed?: string;
        tracks?: TrackItem[];
        tracksLoading?: boolean;
        selectedTrack?: string;
        live?: boolean;
    }>(),
    { playing: false, audioLoaded: false, started: false, elapsed: '00:00', tracks: () => [] }
);

const emit = defineEmits<{
    playPause: [];
    stop: [];
    loadFile: [file: File];
    selectTrack: [id: string];
    toggleLive: [];
}>();

const fileInput = ref<HTMLInputElement | null>(null);

// The idle fork's "Pick a demo" door reaches in and opens the menu
const demoMenuOpen = ref(false);
defineExpose({ openDemoMenu: () => (demoMenuOpen.value = true) });

function pickFile() {
    fileInput.value?.click();
}
function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) emit('loadFile', file);
    input.value = '';
}
</script>

<template>
    <div
        class="ps-glass flex flex-wrap items-center justify-center gap-3.5 px-4 py-3 [clip-path:var(--clip-chamfer-md)]"
    >
        <IconButton
            :icon="playing ? 'i-mingcute-pause-fill' : 'i-mingcute-play-fill'"
            variant="primary"
            size="lg"
            :disabled="!audioLoaded"
            :aria-label="playing ? 'Pause' : 'Play'"
            @click="emit('playPause')"
        />
        <IconButton
            icon="i-mingcute-stop-fill"
            variant="solid"
            size="lg"
            :disabled="!started"
            aria-label="Stop"
            @click="emit('stop')"
        />

        <span class="h-8 w-px bg-(--brand-white)" aria-hidden="true" />

        <Readout label="Elapsed" :value="elapsed" :tone="playing ? 'live' : 'cyan'" />

        <span class="h-8 w-px bg-(--brand-white)" aria-hidden="true" />

        <Button
            variant="secondary"
            class="mr-0 ring-(--brand-primary) text-(--brand-white)"
            icon="i-lucide-upload"
            label="Load Audio"
            @click="pickFile"
        />

        <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="onFile" />

        <label v-if="tracks.length" class="flex flex-col gap-1">
            <USelectMenu
                v-model:open="demoMenuOpen"
                :model-value="selectedTrack"
                :items="tracks"
                value-key="value"
                placeholder="Select Demo Track"
                :loading="tracksLoading"
                color="primary"
                class="w-44 max-w-full [--ui-text-dimmed:var(--brand-white)]"
                :ui="{
                    base: 'rounded-none [clip-path:var(--clip-chamfer-sm)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow) text-(--brand-white) ring-[var(--brand-primary)]',
                    value: 'text-(--brand-white)',
                    label: 'text-(--brand-white)',
                }"
                @update:model-value="(v: string) => v && emit('selectTrack', v)"
            />
        </label>

        <span v-if="track" class="max-w-[16ch] truncate font-mono text-detail text-(--text-muted)">{{ track }}</span>

        <span class="h-8 w-px bg-(--brand-white)" aria-hidden="true" />

        <Button
            :variant="live ? 'primary' : 'secondary'"
            class="mr-0 !ring-(--brand-primary) !text-(--brand-white)"
            icon="i-lucide-keyboard-music"
            label="Live"
            :aria-pressed="live"
            aria-label="Toggle live MIDI input"
            @click="emit('toggleLive')"
        />

        <span class="h-8 w-px bg-(--brand-white)" aria-hidden="true" />

        <Badge
            class="ml-1"
            color="neutral"
            :variant="playing ? 'outline' : 'subtle'"
            :live="playing"
            dot
            :label="playing ? 'Playing' : 'Paused'"
        />
    </div>
</template>
