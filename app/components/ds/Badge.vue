<script setup lang="ts">
/* Badge - status pill skinning UBadge (mono, uppercase, chamfered).
   `live` applies the scope-magenta "live signal" treatment; `dot` adds a
   leading status dot in the current text colour.
   `sketch` swaps the chamfer chrome for Sketch's hard-edged chip: md is
   the workspace language chip (ink border on paper), sm the library
   card chip (hairline border). */
import { computed } from 'vue';

type Color = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';
type BVariant = 'solid' | 'outline' | 'subtle';

const props = withDefaults(
    defineProps<{
        color?: Color;
        variant?: BVariant;
        label?: string;
        live?: boolean;
        dot?: boolean;
        sketch?: boolean;
        size?: 'sm' | 'md';
    }>(),
    {
        color: 'neutral',
        variant: 'outline',
        live: false,
        dot: false,
        sketch: false,
        size: 'md',
    }
);

const phaseScopeBase =
    'font-mono text-caption font-medium uppercase tracking-label-wide rounded-none [clip-path:var(--clip-chamfer-sm)] ';
const liveClass = 'text-(--scope-magenta) border-(--scope-magenta) shadow-(--shadow-glow-live)';
const neutralClass = 'text-(--text-muted)'; // quiet status chip (e.g. PAUSED)

const sketchClass = {
    md: 'font-mono font-normal uppercase rounded-none ring-0 border border-(--border-strong) bg-(--bg) text-(--text) text-(length:--sketch-font-size-micro) tracking-(--label-tracking-wide) px-[7px] py-[3px]',
    sm: 'font-mono font-normal uppercase rounded-none ring-0 border border-(--border) text-(--text) text-(length:--sketch-font-size-nano) tracking-(--label-tracking) px-1.5 py-0.5',
};

const baseClass = computed(() =>
    props.sketch
        ? sketchClass[props.size]
        : [phaseScopeBase, props.live ? liveClass : props.color === 'neutral' ? neutralClass : ''].join(' ')
);
</script>

<template>
    <UBadge :color="color" :variant="variant" :ui="{ base: baseClass }">
        <span
            v-if="dot"
            class="size-1.5 rounded-full bg-current"
            :class="{ 'ps-pulse-live': live }"
            aria-hidden="true"
        />
        <slot>
            <template v-if="sketch">{{ label }}</template>
            <span v-else class="text-(--brand-secondary) text-[1rem]">{{ label }}</span>
        </slot>
    </UBadge>
</template>
