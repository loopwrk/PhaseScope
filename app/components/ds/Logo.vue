<script setup lang="ts">
/* PhaseScope logo - an eye (almond / vesica) outline enclosing a lemniscate
   (figure-8), nodding to the Lissajous figure-of-eight. */
withDefaults(defineProps<{ size?: number | string; mono?: boolean }>(), { size: 24, mono: false });
</script>

<template>
    <svg
        :width="size"
        :height="size"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        role="img"
        aria-label="PhaseScope"
    >
        <!-- eye / almond outline -->
        <path d="M2 16 Q16 3 30 16 Q16 29 2 16 Z" />
        <!-- lemniscate (figure-8) trace -->
        <path
            d="M16 16 C13 12 9 12 9 16 C9 20 13 20 16 16 C19 12 23 12 23 16 C23 20 19 20 16 16 Z"
            :stroke="mono ? 'currentColor' : 'var(--brand-primary)'"
        />
    </svg>
</template>
