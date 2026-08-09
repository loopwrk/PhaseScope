<script setup lang="ts">
/* IconButton - square, icon-only skin of UButton. Same chamfer/glow chrome
   as Button; the sketch variant swaps it for Sketch's hard-edged look
   (ink border, flat hover). Always pass an accessible label via `aria-label`. */
import { computed } from 'vue';
type Variant = 'primary' | 'secondary' | 'solid' | 'ghost' | 'danger' | 'sketch';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const props = withDefaults(
    defineProps<{
        icon: string;
        variant?: Variant;
        size?: Size;
        disabled?: boolean;
        ariaLabel?: string;
    }>(),
    { variant: 'ghost', size: 'md', disabled: false }
);

const variantMap: Record<Variant, { color: 'primary' | 'neutral' | 'error'; variant: 'solid' | 'outline' | 'ghost' }> =
    {
        primary: { color: 'primary', variant: 'solid' },
        secondary: { color: 'primary', variant: 'outline' },
        solid: { color: 'neutral', variant: 'outline' }, // neutral surface + hairline (mockup "solid")
        ghost: { color: 'neutral', variant: 'ghost' },
        danger: { color: 'error', variant: 'solid' },
        sketch: { color: 'neutral', variant: 'ghost' },
    };

const phaseScopeBase = [
    'rounded-none [clip-path:var(--clip-chamfer-sm)]',
    'transition-[transform,box-shadow] duration-150',
    'focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow)',
    'hover:shadow-(--shadow-glow-accent)',
    'active:translate-y-px',
    'disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none',
].join(' ');

const sketchBase = [
    'rounded-none border border-(--border-strong) ring-0',
    'bg-(--surface-elevated) text-(--text)',
    'transition-colors duration-150 hover:bg-(--surface)',
    'focus-visible:ring-0 focus-visible:shadow-none',
    'disabled:opacity-40 disabled:pointer-events-none',
].join(' ');

const baseClass = computed(() => (props.variant === 'sketch' ? sketchBase : phaseScopeBase));
</script>

<template>
    <UButton
        :icon="icon"
        square
        :color="variantMap[variant].color"
        :variant="variantMap[variant].variant"
        :size="size"
        :disabled="disabled"
        :aria-label="ariaLabel"
        :ui="{ base: baseClass }"
    />
</template>
