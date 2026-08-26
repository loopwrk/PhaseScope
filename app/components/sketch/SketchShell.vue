<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
</script>

<template>
    <!-- h-dvh, not min-h-dvh: the workspace distributes a definite height
         down through min-h-0 flex children. With only a min-height nothing
         in the chain is definite, so a long code tab inflates the whole
         page and pushes the canvas off the bottom. -->
    <div class="sketch-theme flex h-dvh flex-col border border-(--border-strong) bg-(--surface)">
        <!-- #header replaces the whole bar (the mobile workspace brings its own) -->
        <slot name="header">
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
        </slot>
        <!-- The workspace fills exactly; the library scrolls inside here. -->
        <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <slot />
        </main>
    </div>
</template>
