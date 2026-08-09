<script setup lang="ts">
/* PhaseScope button - skins Nuxt UI's UButton. Variants map onto Nuxt UI.
   The sketch-* variants are Sketch's hard-edged treatment: mono uppercase
   label, 1px ink border, flat colour swap on hover - no chamfer, no glow
   (see tokens/sketch.css; use inside a .sketch-theme scope). */
// explicit vue import: ds components also mount in Storybook, outside
// Nuxt's auto-imports
import { computed } from 'vue';

type Variant =
    | 'primary'
    | 'secondary'
    | 'neutral'
    | 'ghost'
    | 'danger'
    | 'sketch-primary'
    | 'sketch-surface'
    | 'sketch-panel';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const props = withDefaults(defineProps<{ variant?: Variant; size?: Size; disabled?: boolean; label?: string }>(), {
    variant: 'primary',
    size: 'md',
    disabled: false,
});

const variantMap: Record<Variant, { color: 'primary' | 'neutral' | 'error'; variant: 'solid' | 'outline' | 'ghost' }> =
    {
        primary: { color: 'primary', variant: 'solid' },
        secondary: { color: 'primary', variant: 'outline' },
        // neutral matches the select menu's quiet ring (transport dock kin)
        neutral: { color: 'neutral', variant: 'outline' },
        ghost: { color: 'neutral', variant: 'ghost' },
        danger: { color: 'error', variant: 'solid' },
        'sketch-primary': { color: 'neutral', variant: 'ghost' },
        'sketch-surface': { color: 'neutral', variant: 'ghost' },
        'sketch-panel': { color: 'neutral', variant: 'ghost' },
    };

const phaseScopeBase = [
    'font-display font-semibold tracking-(--label-tracking)',
    'rounded-none [clip-path:var(--clip-chamfer-md)]',
    'transition-[transform,box-shadow] duration-150',
    'focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow)',
    'hover:shadow-(--shadow-glow-accent)',
    'active:translate-y-px',
    'disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none',
].join(' ');

const sketchCore = [
    'font-mono text-caption uppercase tracking-(--label-tracking)',
    'rounded-none border border-(--border-strong) ring-0',
    'transition-colors duration-150',
    'focus-visible:ring-0 focus-visible:shadow-none',
    'disabled:opacity-40 disabled:pointer-events-none',
].join(' ');

const sketchVariant: Record<string, string> = {
    'sketch-primary': 'bg-(--accent) text-(--text) font-semibold hover:bg-(--sketch-accent-hover)',
    'sketch-surface': 'bg-(--surface) text-(--text) hover:bg-(--bg)',
    'sketch-panel': 'bg-(--surface-elevated) text-(--text) hover:bg-(--surface)',
};

/* Sketch control padding from the mock: sm 6x10, md 8x12, lg 11x16. */
const sketchPad: Record<Size, string> = {
    xs: 'px-2 py-1',
    sm: 'px-2.5 py-1.5',
    md: 'px-3 py-2',
    lg: 'px-4 py-[11px]',
    xl: 'px-5 py-3',
};

const isSketch = computed(() => props.variant.startsWith('sketch'));
const baseClass = computed(() =>
    isSketch.value ? [sketchCore, sketchVariant[props.variant], sketchPad[props.size]].join(' ') : phaseScopeBase
);
</script>

<template>
    <UButton
        :color="variantMap[variant].color"
        :variant="variantMap[variant].variant"
        :size="size"
        :disabled="disabled"
        :ui="{ base: baseClass }"
    >
        <slot>{{ label }}</slot>
    </UButton>
</template>
