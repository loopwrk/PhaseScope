<script setup lang="ts">
/* TabStrip - Sketch's pane tabs: hairline-underlined strip where the
   active tab sits on the body surface and covers the strip's hairline
   with a 2px ink underline. Tablist semantics with roving tabindex and
   arrow-key navigation; panels live at the call site (match by value).
   The #trailing slot right-aligns extras (format hint, mobile RUN cell). */
import { ref } from 'vue';

type Tab = { value: string; label: string };

const props = withDefaults(defineProps<{ tabs: Tab[]; modelValue: string; size?: 'sm' | 'md' }>(), { size: 'md' });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const buttons = ref<HTMLButtonElement[]>([]);
function onKeydown(event: KeyboardEvent, index: number) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + props.tabs.length) % props.tabs.length;
    emit('update:modelValue', props.tabs[next]!.value);
    buttons.value[next]?.focus();
}

const sizeClass = {
    md: 'text-caption px-4 py-[11px]',
    sm: 'text-(length:--sketch-font-size-micro) px-3.5 py-3',
};
</script>

<template>
    <div role="tablist" class="flex items-stretch border-b border-(--border) bg-(--surface-elevated)">
        <button
            v-for="(tab, index) in tabs"
            :key="tab.value"
            ref="buttons"
            role="tab"
            type="button"
            :aria-selected="tab.value === modelValue"
            :tabindex="tab.value === modelValue ? 0 : -1"
            class="border-r border-(--border) font-mono tracking-(--label-tracking) uppercase transition-colors duration-150"
            :class="[
                sizeClass[size],
                tab.value === modelValue
                    ? '-mb-px border-b-2 border-b-(--border-strong) bg-(--surface) text-(--text)'
                    : 'text-(--text-muted) hover:text-(--text)',
            ]"
            @click="emit('update:modelValue', tab.value)"
            @keydown="onKeydown($event, index)"
        >
            {{ tab.label }}
        </button>
        <div class="flex-1" />
        <slot name="trailing" />
    </div>
</template>
