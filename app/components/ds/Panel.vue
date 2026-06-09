<script setup lang="ts">
/* Panel - chamfered surface wrapper. Variants:
     solid    (default) opaque --surface
     glass    translucent + backdrop blur, for chrome floating over the
              live canvas; pair with the canvas scrim so text clears AA
     elevated raised --surface-elevated + soft shadow
   Bespoke; the crisp chamfered outline is a masked 1px frame (a clip-path
   can't take a border, so the frame is layered on ::before and masked). */
withDefaults(defineProps<{ variant?: 'solid' | 'glass' | 'elevated' }>(), {
    variant: 'solid',
});
</script>

<template>
    <div class="panel" :class="`panel--${variant}`">
        <slot />
    </div>
</template>

<style scoped>
.panel {
    --panel-border: var(--border);
    position: relative;
    padding: var(--space-4);
    color: var(--text);
    clip-path: var(--clip-chamfer-md);
}
.panel::before {
    content: '';
    position: absolute;
    inset: 0;
    clip-path: var(--clip-chamfer-md);
    padding: var(--hairline);
    background: var(--panel-border);
    -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
    mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
}
.panel--solid {
    background: var(--surface);
}
.panel--elevated {
    background: var(--surface-elevated);
    box-shadow: var(--shadow-md);
}
.panel--glass {
    --panel-border: var(--overlay-border);
    background: var(--overlay-bg);
    backdrop-filter: blur(var(--overlay-blur)) saturate(1.2);
    -webkit-backdrop-filter: blur(var(--overlay-blur)) saturate(1.2);
}
</style>
