<script setup lang="ts">
/* Badge - status pill skinning UBadge (mono, uppercase, chamfered).
   `live` applies the scope-magenta "live signal" treatment; `dot` adds a
   leading status dot in the current text colour. */
type Color = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';
type BVariant = 'solid' | 'outline' | 'subtle';

withDefaults(defineProps<{ color?: Color; variant?: BVariant; label?: string; live?: boolean; dot?: boolean }>(), {
    color: 'neutral',
    variant: 'subtle',
    live: false,
    dot: false,
});

const baseClass =
    'font-mono text-caption font-medium uppercase tracking-label-wide rounded-none [clip-path:var(--clip-chamfer-sm)]';
const liveClass = 'text-(--scope-magenta) border-(--scope-magenta) shadow-(--shadow-glow-live)';
const neutralClass = 'text-(--text-muted)'; // quiet status chip (e.g. PAUSED)
</script>

<template>
    <UBadge
        :color="color"
        :variant="variant"
        :ui="{ base: [baseClass, live ? liveClass : color === 'neutral' ? neutralClass : ''].join(' ') }"
    >
        <span
            v-if="dot"
            class="size-1.5 rounded-full bg-current"
            :class="{ 'ps-pulse-live': live }"
            aria-hidden="true"
        />
        <slot>{{ label }}</slot>
    </UBadge>
</template>
