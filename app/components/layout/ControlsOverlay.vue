<script setup lang="ts">
/* ControlsOverlay - the keyboard HUD: glass panel of uppercase mono section
   labels with KeyCap chips and their actions. */
import KeyCap from '../ds/KeyCap.vue';

const sections: { label: string; keys: { k: string; d: string }[] }[] = [
    {
        label: 'Playback',
        keys: [
            { k: 'ENTER ↵', d: 'Play / pause' },
            { k: 'R', d: 'Render mode' },
            { k: 'O', d: 'Point oscillation' },
        ],
    },
    {
        label: 'Camera',
        keys: [
            { k: 'C', d: 'Cycle camera mode' },
            { k: 'F', d: 'Fullscreen' },
        ],
    },
    {
        label: 'View',
        keys: [
            { k: 'V', d: 'Reverse colour spectrum' },
            { k: 'B', d: 'Dream background' },
            { k: 'N', d: 'Heavenly background' },
            { k: 'H', d: 'Toggle this overlay' },
        ],
    },
    {
        label: 'Tracks',
        keys: [
            { k: '{', d: 'Previous track' },
            { k: '}', d: 'Next track' },
            { k: '[', d: 'Slower' },
            { k: ']', d: 'Faster' },
        ],
    },
];
</script>

<template>
    <aside class="ps-glass flex w-72 flex-col gap-4 p-4 [clip-path:var(--clip-chamfer-md)]">
        <p class="ps-label">Controls</p>
        <div v-for="s in sections" :key="s.label" class="flex flex-col gap-2">
            <p class="ps-label text-(--text-faint)">{{ s.label }}</p>
            <div v-for="row in s.keys" :key="row.k" class="flex items-center gap-3">
                <KeyCap :label="row.k" />
                <span class="text-detail text-(--text-muted)">{{ row.d }}</span>
            </div>
        </div>
    </aside>
</template>
