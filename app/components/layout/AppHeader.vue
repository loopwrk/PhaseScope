<script setup lang="ts">
/* AppHeader - floating glass header: logo/wordmark + chrome tools. */
import IconButton from '../ds/IconButton.vue';

defineEmits<{ toggleControls: []; toggleFullscreen: [] }>();
</script>

<template>
    <header class="ps-glass flex items-center justify-between gap-4 px-4 py-2 [clip-path:var(--clip-chamfer-md)]">
        <div class="flex items-center gap-2">
            <span class="inline-block size-5 bg-(--accent) [clip-path:var(--clip-chamfer-sm)]" aria-hidden="true" />
            <span class="font-display font-semibold tracking-(--label-tracking)">PhaseScope</span>
        </div>
        <div class="flex items-center gap-2">
            <IconButton
                icon="i-lucide-keyboard"
                variant="ghost"
                aria-label="Toggle controls overlay"
                @click="$emit('toggleControls')"
            />
            <IconButton
                icon="i-lucide-maximize"
                variant="ghost"
                aria-label="Toggle fullscreen"
                @click="$emit('toggleFullscreen')"
            />
        </div>
    </header>
</template>
