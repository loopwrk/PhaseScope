<script setup lang="ts">
/* Status dot - the run-state signal (ok green / error red / neutral).
   Pass `label` when the state should be announced, e.g. "ran cleanly". */
withDefaults(defineProps<{ state?: 'ok' | 'error' | 'neutral'; label?: string }>(), { state: 'neutral' });

const fill = { ok: 'bg-(--success)', error: 'bg-(--error)', neutral: 'bg-(--text-faint)' };
</script>

<template>
    <span role="status" class="inline-flex shrink-0 items-center">
        <span class="size-2 rounded-full" :class="fill[state]" aria-hidden="true" />
        <span v-if="label" class="sr-only">{{ label }}</span>
    </span>
</template>
