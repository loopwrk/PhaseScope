<script setup lang="ts">
/* SegmentedControl - hard-edged single-select group (Sketch's aspect
   control): one ink border around the group, cells split by ink
   dividers, the selected cell inverted. Token-driven, so it follows
   whichever theme scope it sits in. Button-group semantics
   (aria-pressed); PhaseScope's glowing segmented look stays in
   segmented.ts. */
import { computed } from 'vue';

type Option = { value: string; label: string };

const props = withDefaults(
    defineProps<{ options: Array<Option | string>; modelValue: string; size?: 'sm' | 'md' }>(),
    { size: 'md' }
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const normalized = computed<Option[]>(() =>
    props.options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option))
);

const pad = { sm: 'px-2 py-1', md: 'px-2.5 py-1.5' };
</script>

<template>
    <div role="group" class="inline-flex border border-(--border-strong) bg-(--surface-elevated)">
        <button
            v-for="option in normalized"
            :key="option.value"
            type="button"
            class="border-l border-(--border-strong) font-mono text-(length:--sketch-font-size-micro) tracking-(--sketch-tracking-tight) uppercase transition-colors duration-150 first:border-l-0"
            :class="[
                pad[size],
                option.value === modelValue
                    ? 'bg-(--text) text-(--surface-elevated)'
                    : 'text-(--text) hover:bg-(--surface)',
            ]"
            :aria-pressed="option.value === modelValue"
            @click="emit('update:modelValue', option.value)"
        >
            {{ option.label }}
        </button>
    </div>
</template>
