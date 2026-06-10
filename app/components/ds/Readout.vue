<script setup lang="ts">
/* Readout - tabular mono numeric display with an optional HUD label and
   unit. For point counts, percentages, dB, sample sizes, elapsed time.
   Tones follow the design's "spectrum trio for data / live cues" rule:
   cyan (default data readout), live (scope-magenta + glow while playing),
   accent and plain text. */
withDefaults(
    defineProps<{
        value?: string | number;
        unit?: string;
        label?: string;
        size?: 'md' | 'lg' | 'mega';
        tone?: 'cyan' | 'live' | 'accent' | 'text';
    }>(),
    { size: 'md', tone: 'cyan' }
);

const numSize: Record<'md' | 'lg' | 'mega', string> = {
    md: 'text-title',
    lg: 'text-display',
    mega: 'text-mega',
};

const toneClass: Record<'cyan' | 'live' | 'accent' | 'text', string> = {
    cyan: 'text-(--scope-cyan)',
    live: 'text-(--scope-magenta) [text-shadow:var(--shadow-glow-live)]',
    accent: 'text-(--accent)',
    text: 'text-(--text)',
};
</script>

<template>
    <div class="inline-flex flex-col gap-1">
        <span
            v-if="label"
            class="font-mono text-caption font-medium uppercase tracking-label-wide text-(--text-muted)"
            >{{ label }}</span
        >
        <span class="inline-flex items-baseline gap-[0.35ch]" :class="toneClass[tone]">
            <span
                class="font-mono font-semibold leading-(--line-height-tight) tracking-label tabular-nums"
                :class="numSize[size]"
                ><slot>{{ value }}</slot></span
            >
            <span v-if="unit" class="font-mono text-[0.7em] text-(--text-muted)">{{ unit }}</span>
        </span>
    </div>
</template>
