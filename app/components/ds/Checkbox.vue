<script setup lang="ts">
/* Checkbox - chamfered box + animated check skin of UCheckbox. */
const model = defineModel<boolean>({ default: false });

withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), {
    disabled: false,
});
</script>

<template>
    <UCheckbox
        v-model="model"
        color="primary"
        :label="label"
        :disabled="disabled"
        :ui="{
            base: 'rounded-none [clip-path:var(--clip-chamfer-sm)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow)',
        }"
    />
</template>
