<script setup lang="ts">
/* AppHeader - transparent floating header over the canvas (no full-width bar,
   per the design comp): logo lockup (mark + two-tone wordmark + mono tagline)
   left, a glass tool cluster right. The controls and settings buttons reflect
   the open state of the panel they toggle (accent fill when open). */
import IconButton from '../ds/IconButton.vue';
import Logo from '../ds/Logo.vue';

withDefaults(defineProps<{ controlsOpen?: boolean; settingsOpen?: boolean }>(), {
    controlsOpen: false,
    settingsOpen: false,
});

defineEmits<{ toggleControls: []; toggleSettings: []; toggleFullscreen: [] }>();
</script>

<template>
    <header class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
            <Logo
                :size="64"
                class="shrink-0 text-(--text) drop-shadow-[0_0_10px_color-mix(in_oklch,var(--scope-cyan)_30%,transparent)]"
            />
            <div class="hidden sm:block">
                <p class="font-display text-title font-semibold leading-none tracking-display">
                    Phase<span class="text-(--accent)">Scope</span>
                </p>
                <p
                    class="mt-1 font-mono text-caption uppercase tracking-label-wide text-(--brand-secondary) ps-weight-bold"
                >
                    Phase-space audio visualiser
                </p>
            </div>
        </div>
        <div class="ps-glass flex items-center gap-1 p-1 [clip-path:var(--clip-chamfer-sm)]">
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
            <IconButton icon="i-lucide-info" variant="ghost" aria-label="About PhaseScope" to="/about" />
        </div>
    </header>
</template>
