<script setup lang="ts">
/* PhaseScope logo - an eye (almond / vesica) outline enclosing a lemniscate
   (figure-8), nodding to the Lissajous figure-of-eight. Drawn in
   currentColor so it inherits text colour (e.g. text-(--accent), which makes
   it palette-reactive). */
withDefaults(defineProps<{ size?: number | string }>(), { size: 24 });
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
        <!-- lemniscate (figure-8) -->
        <path d="M16 16 C13 12 9 12 9 16 C9 20 13 20 16 16 C19 12 23 12 23 16 C23 20 19 20 16 16 Z" />
    </svg>
</template>
