<script setup lang="ts">
/* Switch - chamfered track + sliding chamfered thumb skin of USwitch.
   On = accent fill + glow. */
const model = defineModel<boolean>({ default: false });

withDefaults(defineProps<{ disabled?: boolean; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }>(), {
    disabled: false,
    size: 'md',
});
</script>

<template>
    <USwitch
        v-model="model"
        color="primary"
        :disabled="disabled"
        :size="size"
        :ui="{
            base: 'rounded-none [clip-path:var(--clip-chamfer-sm)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow) data-[state=checked]:shadow-(--shadow-glow-accent)',
            thumb: 'rounded-none [clip-path:var(--clip-chamfer-sm)]',
        }"
    />
</template>
