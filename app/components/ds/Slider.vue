<script setup lang="ts">
/* Slider - chamfered groove + accent fill + glowing chamfered thumb skin of
   USlider. Pair with a Readout for the value (see Readout). */
const model = defineModel<number>({ default: 0 });

withDefaults(defineProps<{ min?: number; max?: number; step?: number; disabled?: boolean }>(), {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
});
</script>

<template>
    <USlider
        v-model="model"
        color="primary"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        :ui="{
            track: 'bg-(--surface-sunken) rounded-none [clip-path:var(--clip-chamfer-sm)]',
            range: 'bg-(--accent) rounded-none',
            thumb: 'rounded-none [clip-path:var(--clip-chamfer-sm)] bg-(--accent) shadow-(--shadow-glow-accent) focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow)',
        }"
    />
</template>
