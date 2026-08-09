<script setup lang="ts">
/* Live KaTeX rendering of the maths tab. The whole tab body is treated
   as one display-mode block; KaTeX's own error rendering (throwOnError
   false) marks bad TeX inline instead of blanking the preview. Client
   only - katex touches the DOM. */
import { ref, watchEffect } from 'vue';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const props = defineProps<{ source: string }>();
const html = ref('');

watchEffect(() => {
    const trimmed = props.source.trim();
    html.value = trimmed
        ? katex.renderToString(trimmed, { displayMode: true, throwOnError: false, errorColor: 'var(--error)' })
        : '';
});
</script>

<template>
    <!-- html is katex renderToString output of the user's own local source, not remote content -->
    <!-- eslint-disable vue/no-v-html -->
    <div
        v-if="html"
        class="max-h-56 shrink-0 overflow-auto border-t border-(--border) bg-(--surface) px-[18px] py-4 text-(--text)"
        v-html="html"
    />
</template>
