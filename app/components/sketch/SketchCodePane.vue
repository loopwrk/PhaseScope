<script setup lang="ts">
import { computed, ref } from 'vue';
import TabStrip from '../ds/TabStrip.vue';
import StatusDot from '../ds/StatusDot.vue';
import SketchEditor from './SketchEditor.vue';
import SketchMathsPreview from './SketchMathsPreview.vue';
import type { SketchLanguage } from '~/utils/sketch/model';

const props = defineProps<{
    language: SketchLanguage;
    result?: { ok: boolean; message: string } | null;
    /* mobile: full-width stack - RUN cell pinned in the tab strip, code
       one step smaller (13/1.7 via the token overrides below). */
    mobile?: boolean;
}>();
const emit = defineEmits<{ run: [] }>();
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
        class="flex flex-col bg-(--surface-elevated)"
        :class="
            mobile
                ? 'min-h-0 flex-1 [--sketch-code-leading:1.7] [--sketch-font-size-code:0.8125rem]'
                : 'w-[560px] shrink-0 border-r border-(--border-strong) max-[1200px]:w-[480px]'
        "
    >
        <TabStrip v-model="activeTab" :tabs="TABS" :size="mobile ? 'sm' : 'md'">
            <template #trailing>
                <button
                    v-if="mobile"
                    type="button"
                    class="cursor-pointer border-l border-(--border-strong) bg-(--accent) px-4 font-mono text-(length:--sketch-font-size-micro) font-semibold tracking-label uppercase transition-colors duration-(--motion-duration-fast) hover:bg-(--sketch-accent-hover)"
                    @click="emit('run')"
                >
                    Run
                </button>
                <span
                    v-else
                    class="self-center px-3.5 font-mono text-(length:--sketch-font-size-micro) text-(--text-muted)"
                    title="Format document"
                >
                    ⌥⇧F
                </span>
            </template>
        </TabStrip>

        <SketchEditor v-model="active" :language="editorLanguage" />
        <SketchMathsPreview v-if="activeTab === 'maths'" :source="maths" />

        <footer class="flex items-center gap-3.5 border-t border-(--border-strong) bg-(--surface) px-4 py-2.5">
            <span
                class="font-mono text-(length:--sketch-font-size-micro) tracking-label-wide text-(--text-muted) uppercase"
            >
                Output
            </span>
            <span
                class="max-h-24 flex-1 overflow-y-auto font-(family-name:--font-code)"
                :class="[
                    mobile ? 'text-xs' : 'text-detail',
                    result ? (result.ok ? (mobile ? 'text-(--sketch-console-text)' : 'text-(--text)') : 'text-(--error)') : 'text-(--text-muted)',
                ]"
            >
                {{ result?.message ?? 'not run yet' }}
            </span>
            <StatusDot
                :state="result ? (result.ok ? 'ok' : 'error') : 'neutral'"
                :label="result ? (result.ok ? 'ran cleanly' : 'run failed') : 'not run yet'"
            />
        </footer>
    </section>
</template>
