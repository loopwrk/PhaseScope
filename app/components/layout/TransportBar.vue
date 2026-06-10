<script setup lang="ts">
/* TransportBar - floating glass transport. Controlled: the parent owns the
   audio/engine state and handlers; this component is presentation + events.
     - play/pause + stop (disabled per audioLoaded / started)
     - Load Audio (opens a file picker, emits the chosen File)
     - demo-track select (emits the chosen id)
     - current track, elapsed readout, live badge while playing */
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
    }>(),
    { playing: false, audioLoaded: false, started: false, tracks: () => [] }
);

const emit = defineEmits<{
    playPause: [];
    stop: [];
    loadFile: [file: File];
    selectTrack: [id: string];
}>();

const fileInput = ref<HTMLInputElement | null>(null);

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
    <div class="ps-glass flex items-center gap-3 px-4 py-2 [clip-path:var(--clip-chamfer-md)]">
        <IconButton
            :icon="playing ? 'i-mingcute-pause-fill' : 'i-mingcute-play-fill'"
            variant="primary"
            :disabled="!audioLoaded"
            :aria-label="playing ? 'Pause' : 'Play'"
            @click="emit('playPause')"
        />
        <IconButton
            icon="i-mingcute-stop-fill"
            variant="ghost"
            :disabled="!started"
            aria-label="Stop"
            @click="emit('stop')"
        />

        <Button variant="secondary" label="Load Audio" @click="pickFile" />
        <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="onFile" />

        <USelectMenu
            v-if="tracks.length"
            :model-value="selectedTrack"
            :items="tracks"
            value-key="value"
            placeholder="Demo track"
            :loading="tracksLoading"
            class="w-44"
            :ui="{ base: 'rounded-none [clip-path:var(--clip-chamfer-sm)]' }"
            @update:model-value="(v: string) => v && emit('selectTrack', v)"
        />

        <span v-if="track" class="max-w-[16ch] truncate font-mono text-detail text-(--text-muted)">{{ track }}</span>

        <div class="ml-auto flex items-center gap-3">
            <Readout v-if="elapsed" :value="elapsed" />
            <Badge v-if="playing" label="Live" :live="true" variant="outline" />
        </div>
    </div>
</template>
