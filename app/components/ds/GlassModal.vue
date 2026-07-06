<script setup lang="ts">
defineProps<{ title: string }>();

const emit = defineEmits<{ close: [] }>();
</script>

<template>
    <div
        class="absolute inset-0 z-40 flex items-center justify-center bg-[color-mix(in_oklch,var(--bg)_80%,transparent)] px-6"
        @click.self="emit('close')"
    >
        <div
            class="ps-glass flex max-h-[70svh] w-full max-w-sm flex-col border border-(--border-strong) [clip-path:var(--clip-notch)]"
        >
            <div class="flex items-center justify-between gap-2 border-b border-(--border-strong) px-4 py-3">
                <span class="font-display text-body font-semibold">{{ title }}</span>
                <button
                    type="button"
                    class="text-(--text-muted) hover:text-(--text) focus-visible:outline-none focus-visible:shadow-(--focus-glow)"
                    aria-label="Close"
                    @click="emit('close')"
                >
                    <UIcon name="i-lucide-x" class="size-5" />
                </button>
            </div>
            <slot />
        </div>
    </div>
</template>
