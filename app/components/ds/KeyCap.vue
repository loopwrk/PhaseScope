<script setup lang="ts">
/* KeyCap - a keyboard-hint chip */
withDefaults(defineProps<{ accent?: boolean; label?: string }>(), {
    accent: false,
});
</script>

<template>
    <kbd
        class="inline-flex min-w-[1.6em] items-center justify-center border bg-(--surface-sunken) px-[0.45em] py-[0.15em] font-mono text-caption font-medium uppercase leading-none tracking-label [clip-path:var(--clip-chamfer-sm)]"
        :class="
            accent
                ? 'text-(--accent) border-(--accent) shadow-(--shadow-glow-accent)'
                : 'text-(--text-muted) border-(--border-strong)'
        "
    >
        <slot>{{ label }}</slot>
    </kbd>
</template>
