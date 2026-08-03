<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
</script>

<template>
    <div class="sketch-theme flex min-h-dvh flex-col border border-(--border-strong) bg-(--surface)">
        <header
            class="flex items-center border-b border-(--border-strong) bg-(--surface-elevated)"
            :class="compact ? 'gap-3.5 px-4 py-[13px]' : 'gap-5 px-[18px] py-3.5'"
        >
            <SketchMark :size="compact ? 'md' : 'lg'" />
            <span class="font-mono text-detail font-semibold tracking-(--sketch-tracking-tight)">SKETCH</span>
            <slot name="identity" />
            <div class="flex-1" />
            <slot name="actions" />
            <NuxtLink
                to="/"
                class="font-mono text-(length:--sketch-font-size-micro) tracking-label text-(--text-muted) no-underline transition-colors duration-(--motion-duration-fast) hover:text-(--sketch-accent-ink) hover:no-underline"
            >
                ↩ PHASESCOPE
            </NuxtLink>
        </header>
        <main class="flex min-h-0 flex-1 flex-col">
            <slot />
        </main>
    </div>
</template>
