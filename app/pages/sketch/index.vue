<script setup lang="ts">
/* Sketch library. WIP. */
useSeoMeta({ title: 'Sketch' });
</script>

<template>
    <SketchShell compact>
        <template #identity>
            <span class="font-mono text-caption tracking-label text-(--text-muted)">/ SKETCHES</span>
        </template>
        <div class="sketch-grid-dots flex-1" />
    </SketchShell>
</template>
