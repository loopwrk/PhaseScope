<script setup lang="ts">
import { computed, ref } from 'vue';
import TabStrip from '../ds/TabStrip.vue';
import StatusDot from '../ds/StatusDot.vue';
import SketchEditor from './SketchEditor.vue';
import type { SketchLanguage } from '~/utils/sketch/model';

const props = defineProps<{ language: SketchLanguage }>();
const code = defineModel<string>('code', { default: '' });
const maths = defineModel<string>('maths', { default: '' });
const notes = defineModel<string>('notes', { default: '' });

const TABS = [
    { value: 'code', label: 'Code' },
    { value: 'maths', label: 'Maths' },
    { value: 'notes', label: 'Notes' },
];
const activeTab = ref<'code' | 'maths' | 'notes'>('code');

const models = { code, maths, notes };
const active = computed({
    get: () => models[activeTab.value].value,
    set: (value: string) => (models[activeTab.value].value = value),
});
const editorLanguage = computed(() =>
    activeTab.value === 'code' && props.language === 'js' ? ('js' as const) : ('plain' as const)
);
</script>

<template>
    <section
        class="flex w-[560px] shrink-0 flex-col border-r border-(--border-strong) bg-(--surface-elevated) max-[1200px]:w-[480px]"
    >
        <TabStrip v-model="activeTab" :tabs="TABS">
            <template #trailing>
                <span
                    class="self-center px-3.5 font-mono text-(length:--sketch-font-size-micro) text-(--text-muted)"
                    title="Format document"
                >
                    ⌥⇧F
                </span>
            </template>
        </TabStrip>

        <SketchEditor v-model="active" :language="editorLanguage" />

        <footer class="flex items-center gap-3.5 border-t border-(--border-strong) bg-(--surface) px-4 py-2.5">
            <span
                class="font-mono text-(length:--sketch-font-size-micro) tracking-label-wide text-(--text-muted) uppercase"
            >
                Output
            </span>
            <span class="flex-1 truncate font-(family-name:--font-code) text-detail text-(--text-muted)">
                not run yet
            </span>
            <StatusDot state="neutral" label="not run yet" />
        </footer>
    </section>
</template>
