<script setup lang="ts">
/* DemoPickerOverlay - the mobile demo-track picker. The transport's dropdown
   is hidden during phone onboarding, so "Pick a demo" opens this modal list
   instead (desktop keeps the bottom-bar dropdown). Rows come pre-built from
   useDemoMenu: group headings, separator rules, and selectable tracks. */
import GlassModal from '../ds/GlassModal.vue';
import type { DemoMenuItem } from '~/composables/useDemoMenu';

defineProps<{ items: DemoMenuItem[] }>();

const emit = defineEmits<{
    pick: [id: string];
    close: [];
}>();
</script>

<template>
    <GlassModal title="Pick a demo" @close="emit('close')">
        <ul class="flex flex-col gap-0.5 overflow-y-auto p-2">
            <!-- Track rows have no `type` key, so `'type' in item` splits the
                 union: structural rows (label/separator) one way, tracks the
                 other - each branch fully narrowed, no casts. -->
            <template v-for="(item, i) in items" :key="i">
                <li
                    v-if="'type' in item && item.type === 'label'"
                    class="px-3 pb-1 pt-3 font-mono text-caption uppercase tracking-label text-(--brand-white)"
                >
                    {{ item.label }}
                </li>
                <li v-else-if="'type' in item" :class="['mx-2 my-1 h-px', item.class]" aria-hidden="true" />
                <li v-else>
                    <button
                        type="button"
                        class="w-full px-3 py-2 text-left text-detail text-(--text) hover:bg-(--surface-sunken) focus-visible:outline-none focus-visible:shadow-(--focus-glow)"
                        @click="emit('pick', item.value)"
                    >
                        {{ item.label }}
                    </button>
                </li>
            </template>
        </ul>
    </GlassModal>
</template>
