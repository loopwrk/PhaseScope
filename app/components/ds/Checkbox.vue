<script setup lang="ts">
/* Checkbox - chamfered box + animated check skin of UCheckbox. */
const model = defineModel<boolean>({ default: false });

withDefaults(
    defineProps<{
        label?: string;
        disabled?: boolean;
        color?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
    }>(),
    {
        disabled: false,
    }
);
</script>

<template>
    <UCheckbox
        v-model="model"
        :color="color"
        :label="label"
        :disabled="disabled"
        icon="i-mingcute-check-fill"
        :ui="{
            base: 'rounded-none [clip-path:var(--clip-chamfer-sm)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow) ring-(--brand-primary)',
            icon: 'text-(--bg)',
        }"
    />
</template>
