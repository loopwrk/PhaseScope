<script setup lang="ts">
/* RadioGroup - chamfered radio indicators skin of URadioGroup. */
type RadioItem = string | { label: string; value: string | number; description?: string; disabled?: boolean };

const model = defineModel<string | number>();

withDefaults(
    defineProps<{
        items?: RadioItem[];
        disabled?: boolean;
        orientation?: 'horizontal' | 'vertical';
    }>(),
    { orientation: 'vertical', disabled: false }
);
</script>

<template>
    <URadioGroup
        v-model="model"
        color="primary"
        :items="items"
        :disabled="disabled"
        :orientation="orientation"
        :ui="{
            base: 'rounded-none [clip-path:var(--clip-chamfer-sm)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow)',
            indicator: 'rounded-none [clip-path:var(--clip-chamfer-sm)]',
            description: 'text-(--text-muted)',
        }"
    />
</template>
