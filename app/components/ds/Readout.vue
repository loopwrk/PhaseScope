<script setup lang="ts">
/* Readout - tabular mono numeric display with an optional HUD label and
   unit. For point counts, percentages, dB, sample sizes, elapsed time. */
withDefaults(
    defineProps<{
        value?: string | number;
        unit?: string;
        label?: string;
        size?: 'md' | 'lg' | 'mega';
    }>(),
    { size: 'md' }
);

const numSize: Record<'md' | 'lg' | 'mega', string> = {
    md: 'text-title',
    lg: 'text-display',
    mega: 'text-mega',
};
</script>

<template>
    <div class="inline-flex flex-col gap-1">
        <span
            v-if="label"
            class="font-mono text-caption font-medium uppercase tracking-label-wide text-(--text-muted)"
            >{{ label }}</span
        >
        <span class="inline-flex items-baseline gap-[0.35ch] text-(--text)">
            <span class="font-mono leading-(--line-height-tight) tracking-label tabular-nums" :class="numSize[size]"
                ><slot>{{ value }}</slot></span
            >
            <span v-if="unit" class="font-mono text-[0.7em] text-(--text-muted)">{{ unit }}</span>
        </span>
    </div>
</template>
