<script setup lang="ts">
/* TransportBar - floating glass transport: play/pause/stop, Load Audio,
   current track, elapsed readout, and a live badge while playing. */
import IconButton from '../ds/IconButton.vue';
import Button from '../ds/Button.vue';
import Readout from '../ds/Readout.vue';
import Badge from '../ds/Badge.vue';

withDefaults(defineProps<{ playing?: boolean; track?: string; elapsed?: string }>(), {
    playing: false,
    track: 'a-01-lusocereus',
    elapsed: '00:00',
});

defineEmits<{ playPause: []; stop: []; load: [] }>();
</script>

<template>
    <div class="ps-glass flex items-center gap-3 px-4 py-2 [clip-path:var(--clip-chamfer-md)]">
        <IconButton
            :icon="playing ? 'i-mingcute-pause-fill' : 'i-mingcute-play-fill'"
            variant="primary"
            :aria-label="playing ? 'Pause' : 'Play'"
            @click="$emit('playPause')"
        />
        <IconButton icon="i-mingcute-stop-fill" variant="ghost" aria-label="Stop" @click="$emit('stop')" />
        <Button variant="secondary" label="Load Audio" @click="$emit('load')" />
        <span class="max-w-[16ch] truncate font-mono text-detail text-(--text-muted)">{{ track }}</span>
        <div class="ml-auto flex items-center gap-3">
            <Readout :value="elapsed" />
            <Badge v-if="playing" label="Live" :live="true" variant="outline" />
        </div>
    </div>
</template>
