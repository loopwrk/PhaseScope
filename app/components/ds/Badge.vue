<script setup lang="ts">
/* Badge - status pill skinning UBadge (mono, uppercase, chamfered). */
type Color = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';
type BVariant = 'solid' | 'outline' | 'subtle';

withDefaults(defineProps<{ color?: Color; variant?: BVariant; label?: string; live?: boolean }>(), {
    color: 'neutral',
    variant: 'subtle',
    live: false,
});

const baseClass =
    'font-mono text-caption font-medium uppercase tracking-label-wide rounded-none [clip-path:var(--clip-chamfer-sm)]';
const liveClass = 'text-(--scope-magenta) border-(--scope-magenta) shadow-(--shadow-glow-live)';
</script>

<template>
    <UBadge
        :color="color"
        :variant="variant"
        :label="label"
        :ui="{ base: [baseClass, live ? liveClass : ''].join(' ') }"
    >
        <slot />
    </UBadge>
</template>
