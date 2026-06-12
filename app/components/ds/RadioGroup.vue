<script setup lang="ts">
/* RadioGroup - chamfered radio indicators skin of URadioGroup. */
type RadioItem = string | { label: string; value: string | number; description?: string; disabled?: boolean };

const model = defineModel<string | number>();

withDefaults(
    defineProps<{
        items?: RadioItem[];
        disabled?: boolean;
        orientation?: 'horizontal' | 'vertical';
        color?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
    }>(),
    { orientation: 'vertical', disabled: false, color: 'primary' }
);
</script>

<template>
    <URadioGroup
        v-model="model"
        :color="color"
        :items="items"
        :disabled="disabled"
        :orientation="orientation"
        :ui="{
            base: 'rounded-none [clip-path:var(--clip-chamfer-sm)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow) ring-(--brand-primary) ',
            indicator: 'rounded-none [clip-path:var(--clip-chamfer-sm)]',
            description: 'text-(--text-muted)',
        }"
    />
</template>
