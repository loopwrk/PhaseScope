<script setup lang="ts">
/* AppHeader - floating glass header: logo/wordmark + chrome tools. The controls
   and settings buttons reflect the open state of the panel they toggle (accent
   outline when open). */
import IconButton from '../ds/IconButton.vue';
import Logo from '../ds/Logo.vue';

withDefaults(defineProps<{ controlsOpen?: boolean; settingsOpen?: boolean }>(), {
    controlsOpen: false,
    settingsOpen: false,
});

defineEmits<{ toggleControls: []; toggleSettings: []; toggleFullscreen: [] }>();
</script>

<template>
    <header class="ps-glass flex items-center justify-between gap-4 px-4 py-2 [clip-path:var(--clip-chamfer-md)]">
        <div class="flex items-center gap-2">
            <Logo :size="35" class="text-(--accent)" />
            <span class="hidden font-display font-semibold tracking-(--label-tracking) sm:inline">PhaseScope</span>
        </div>
        <div class="flex items-center gap-2">
            <IconButton
                icon="i-lucide-keyboard"
                :variant="controlsOpen ? 'secondary' : 'ghost'"
                :aria-label="controlsOpen ? 'Hide controls overlay' : 'Show controls overlay'"
                :aria-pressed="controlsOpen"
                @click="$emit('toggleControls')"
            />
            <IconButton
                icon="i-lucide-sliders-horizontal"
                :variant="settingsOpen ? 'secondary' : 'ghost'"
                :aria-label="settingsOpen ? 'Hide settings' : 'Show settings'"
                :aria-pressed="settingsOpen"
                @click="$emit('toggleSettings')"
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
