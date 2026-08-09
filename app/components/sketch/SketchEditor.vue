<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { tags } from '@lezer/highlight';

const props = withDefaults(defineProps<{ modelValue: string; language?: 'js' | 'plain' }>(), { language: 'plain' });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const host = ref<HTMLDivElement>();
let view: EditorView | undefined;
const langCompartment = new Compartment();

const langExtension = () => (props.language === 'js' ? javascript() : []);

const sketchTheme = EditorView.theme({
    '&': { height: '100%', backgroundColor: 'var(--surface-elevated)' },
    '.cm-scroller': {
        fontFamily: 'var(--font-code)',
        fontSize: 'var(--sketch-font-size-code)',
        lineHeight: 'var(--sketch-code-leading)',
    },
    '.cm-content': { padding: '16px 0', caretColor: 'var(--text)' },
    '.cm-line': { padding: '0 18px' },
    '.cm-gutters': {
        backgroundColor: 'var(--surface)',
        color: 'var(--text-faint)',
        border: 'none',
        borderRight: '1px solid var(--sketch-hairline-soft)',
        paddingTop: '16px',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px', minWidth: '3ch' },
    '.cm-cursor': { borderLeftColor: 'var(--text)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--selection-bg)',
        opacity: '0.35',
    },
});

const sketchHighlight = HighlightStyle.define([
    { tag: tags.comment, color: 'var(--sketch-syntax-comment)' },
    { tag: tags.keyword, color: 'var(--sketch-syntax-keyword)' },
    { tag: tags.number, color: 'var(--sketch-syntax-number)' },
    {
        tag: [tags.typeName, tags.standard(tags.variableName), tags.string, tags.special(tags.string)],
        color: 'var(--sketch-syntax-type)',
    },
    {
        tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
        color: 'var(--sketch-syntax-function)',
    },
]);

onMounted(() => {
    view = new EditorView({
        parent: host.value!,
        state: EditorState.create({
            doc: props.modelValue,
            extensions: [
                lineNumbers(),
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                langCompartment.of(langExtension()),
                sketchTheme,
                syntaxHighlighting(sketchHighlight),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) emit('update:modelValue', update.state.doc.toString());
                }),
            ],
        }),
    });
});
onUnmounted(() => view?.destroy());

watch(
    () => props.modelValue,
    (value) => {
        if (view && value !== view.state.doc.toString()) {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
        }
    }
);
watch(
    () => props.language,
    () => view?.dispatch({ effects: langCompartment.reconfigure(langExtension()) })
);
</script>

<template>
    <div ref="host" class="min-h-0 flex-1 overflow-hidden [&_.cm-editor]:h-full" />
</template>
