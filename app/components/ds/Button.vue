<script setup lang="ts">
/* PhaseScope button - skins Nuxt UI's UButton. Variants map onto Nuxt UI */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

withDefaults(defineProps<{ variant?: Variant; size?: Size; disabled?: boolean; label?: string }>(), {
    variant: 'primary',
    size: 'md',
    disabled: false,
});

const variantMap: Record<Variant, { color: 'primary' | 'neutral' | 'error'; variant: 'solid' | 'outline' | 'ghost' }> =
    {
        primary: { color: 'primary', variant: 'solid' },
        secondary: { color: 'primary', variant: 'outline' },
        ghost: { color: 'neutral', variant: 'ghost' },
        danger: { color: 'error', variant: 'solid' },
    };

const baseClass = [
    'font-display font-semibold tracking-[var(--label-tracking)]',
    'rounded-none [clip-path:var(--clip-chamfer-md)]',
    'transition-[transform,box-shadow] duration-150',
    'focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-[var(--focus-glow)]',
    'hover:shadow-[var(--shadow-glow-accent)]',
    'active:translate-y-px',
    'disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none',
].join(' ');
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
