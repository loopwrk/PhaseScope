<script setup lang="ts">
/* Live KaTeX rendering of the maths tab, mounted above the canvas well
   so the equation sits with the wave it describes whichever tab is being
   edited. The whole tab body is treated as one display-mode block;
   KaTeX's own error rendering (throwOnError false) marks bad TeX inline
   instead of blanking the preview.

   The equation is also the control surface: each assignment's number is
   an input bound straight to the maths source, so editing 220 here, in
   the PARAMS bar, or in the maths tab itself are all the same edit.

   The HTML is rendered as a string so SSR emits plain KaTeX markup, then
   the client colours the variables and mounts the inputs in place after
   each patch - enhancing hydrated DOM rather than baking either into the
   string, so there is no hydration mismatch to manage. */
import { computed, ref, useId, watchEffect } from 'vue';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { highlightVariables } from '~/utils/sketch/maths-highlight';
import { mountParamInputs } from '~/utils/sketch/maths-inputs';
import { extractParams, setParamValue, tagParamValues } from '~/utils/sketch/params';

const source = defineModel<string>({ default: '' });

const props = defineProps<{
    /* Held by the caller while a control is driving a value - re-rendering
       KaTeX on every pointermove is the expensive part, and the control
       shows the number itself meanwhile. */
    hold?: boolean;
    /* Parameter names whose inline field must refuse edits. */
    locked?: readonly string[];
}>();
/* The colours the equation gave each symbol, so knobs can match them. */
const emit = defineEmits<{ colours: [Map<string, string>] }>();

const html = ref('');
/* Held while a value is being dragged. A drag commits on every step, and
   re-rendering the block would destroy the element the pointer is
   captured on - so the markup is frozen for the length of the gesture
   while the model (and with it the canvas) keeps updating. */
const scrubbing = ref(false);
const host = ref<HTMLElement>();
/* Scopes the slot ids to this instance, so a second preview on the page
   can never steal the first one's inputs. */
const idPrefix = useId();

const params = computed(() => extractParams(source.value));

watchEffect(() => {
    const trimmed = source.value.trim();
    /* Read before the guard so both stay tracked: releasing the drag
       re-runs this and renders the settled value. */
    if (scrubbing.value || props.hold) return;
    html.value = trimmed
        ? katex.renderToString(tagParamValues(trimmed, idPrefix), {
              displayMode: true,
              throwOnError: false,
              errorColor: 'var(--error)',
              /* Only the slot wrapper we inject ourselves - \href and the
                 rest stay untrusted even though the TeX is local. */
              trust: (context) => context.command === '\\htmlId',
              strict: (code: string) => (code === 'htmlExtension' ? 'ignore' : 'warn'),
          })
        : '';
});

/* flush: 'post' so v-html has patched the DOM and `host` is bound; it
   re-runs on every markup change, which is what re-colours the equation
   and re-mounts the inputs as the maths tab is typed into. */
watchEffect(
    () => {
        void html.value;
        if (scrubbing.value || props.hold || !host.value) return;
        emit('colours', highlightVariables(host.value));
        mountParamInputs(host.value, params.value, idPrefix, {
            locked: props.locked,
            commit: (name, value) => {
                source.value = setParamValue(source.value, name, value);
            },
            onScrubStart: () => (scrubbing.value = true),
            onScrubEnd: () => (scrubbing.value = false),
        });
    },
    { flush: 'post' }
);
</script>

<template>
    <!-- html is katex renderToString output of the user's own local source, not remote content -->
    <!-- eslint-disable vue/no-v-html -->
    <div
        v-if="html"
        ref="host"
        class="max-h-[min(14rem,26dvh)] shrink-0 overflow-auto border-b border-(--border) bg-(--surface) px-[18px] py-3.5 text-[1.5em] text-(--text) [@media(max-height:860px)]:py-2.5 [@media(max-height:860px)]:text-[1.1em]"
        v-html="html"
    />
</template>
