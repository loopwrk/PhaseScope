<script setup lang="ts">
/* Panel - chamfered surface wrapper. Variants:
     solid    (default) opaque --surface
     glass    translucent + backdrop blur, for chrome floating over the
              live canvas; pair with the canvas scrim so text clears AA
     elevated raised --surface-elevated + soft shadow
   Optional HUD header strip (striated, uppercase mono title) via the
   `title` prop / `header-right` slot; body content goes in the default slot.
   Bespoke; the crisp chamfered outline is a masked 1px frame (a clip-path
   can't take a border, so the frame is layered on ::before and masked). */
withDefaults(defineProps<{ variant?: 'solid' | 'glass' | 'elevated'; title?: string }>(), {
    variant: 'solid',
});
</script>

<template>
    <div class="panel" :class="[`panel--${variant}`, { 'panel--headed': title || $slots.headerRight }]">
        <header v-if="title || $slots.headerRight" class="panel__header">
            <span class="panel__title">{{ title }}</span>
            <slot name="headerRight" />
        </header>
        <div class="panel__body"><slot /></div>
    </div>
</template>

<style scoped>
.panel {
    --panel-border: var(--border);
    position: relative;
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
    z-index: 1;
}
.panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: calc(var(--space-2) + 0.125rem) var(--space-4);
    border-bottom: var(--hairline) solid var(--panel-border);
    background-image: var(--striation);
    color: var(--text-muted);
}
.panel__title {
    color: var(--ui-text-white);
    font-family: var(--font-mono);
    font-size: var(--text-heading);
    letter-spacing: var(--label-tracking-wide);
    text-transform: uppercase;
}
.panel__body {
    padding: var(--space-4);
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
