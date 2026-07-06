<script setup lang="ts">
/* DevPlaylistBar - DEV-ONLY floating chip (the page renders it inside an
   import.meta.dev guard, lazily, so production never fetches this chunk).
   Open a local folder as a playlist and toggle auto-play-next; the logic
   lives in useDevPlaylist, this is presentation + the folder input. */
import { ref } from 'vue';
import IconButton from '../ds/IconButton.vue';
import Switch from '../ds/Switch.vue';

defineProps<{ trackCount: number }>();

const autoAdvance = defineModel<boolean>('autoAdvance', { default: false });

const emit = defineEmits<{ openFolder: [files: File[]] }>();

const folderInput = ref<HTMLInputElement | null>(null);
const onFolder = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files ? [...input.files] : [];
    if (files.length) emit('openFolder', files);
    input.value = '';
};
</script>

<template>
    <div class="ps-glass flex items-center gap-2.5 px-3 py-2 [clip-path:var(--clip-chamfer-sm)]">
        <span class="font-mono text-caption uppercase tracking-label text-(--brand-secondary)">Dev</span>
        <span class="h-4 w-px bg-(--border-strong)" aria-hidden="true" />
        <IconButton
            icon="i-lucide-folder-open"
            variant="ghost"
            size="sm"
            aria-label="Open a folder as a playlist"
            @click="folderInput?.click()"
        />
        <span v-if="trackCount" class="font-mono text-caption text-(--text-muted)">{{ trackCount }} trk</span>
        <span class="h-4 w-px bg-(--border-strong)" aria-hidden="true" />
        <label class="flex cursor-pointer items-center gap-1.5 text-caption text-(--text-muted)">
            <Switch v-model="autoAdvance" size="sm" />
            Auto-play next
        </label>
        <input ref="folderInput" type="file" webkitdirectory class="hidden" @change="onFolder" />
    </div>
</template>
