<script setup lang="ts">
/* KeyCap - a keyboard-hint chip. Sizing is em-based, so the size prop
   scales the whole cap through its font-size. */
withDefaults(defineProps<{ accent?: boolean; label?: string; size?: 'sm' | 'md' | 'lg' }>(), {
    accent: false,
    size: 'sm',
});

const sizeClass = { sm: 'text-caption', md: 'text-detail', lg: 'text-body' };
</script>

<template>
    <kbd
        class="inline-flex min-w-[1.6em] items-center justify-center border px-[0.45em] py-[0.25em] font-mono font-medium uppercase leading-none tracking-label [clip-path:var(--clip-chamfer-sm)]"
        :class="[
            sizeClass[size],
            accent
                ? 'text-(--accent) border-(--brand-tertiary) shadow-(--shadow-glow-accent)'
                : 'text-(--brand-tertiary) border-(--border-strong)',
        ]"
    >
        <slot>{{ label }}</slot>
    </kbd>
</template>
