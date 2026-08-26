<script setup lang="ts">
/* PARAMS strip - a number field per simple assignment in the maths tab.
   The maths text is the single source of truth: fields render what
   extractParams finds and commit edits back through setParamValue, so
   the equation, the fields and the next RUN always agree. Commits on
   change (blur/enter), not per keystroke, so typing in the maths
   editor and the fields never fight over the document. */
import { computed } from 'vue';
import { extractParams, setParamValue } from '~/utils/sketch/params';

const maths = defineModel<string>({ default: '' });
/* Parameter names that cannot be edited right now - see LOCKED_WHILE_PLAYING. */
const props = withDefaults(defineProps<{ locked?: readonly string[] }>(), { locked: () => [] });
const params = computed(() => extractParams(maths.value));
const isLocked = (name: string) => props.locked.includes(name);

function commit(name: string, raw: string) {
    const value = Number(raw);
    if (Number.isFinite(value)) maths.value = setParamValue(maths.value, name, value);
}
</script>

<template>
    <div
        v-if="params.length"
        class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-(--border) bg-(--surface) px-4 py-2"
    >
        <span class="font-mono text-(length:--sketch-font-size-micro) tracking-label-wide text-(--text-muted) uppercase">
            Params
        </span>
        <label v-for="p in params" :key="p.name" class="flex items-center gap-1.5">
            <span class="font-mono text-(length:--sketch-font-size-micro) text-(--text-muted)">{{ p.display }}</span>
            <input
                type="number"
                step="any"
                :value="p.value"
                :aria-label="`Parameter ${p.name}`"
                :disabled="isLocked(p.name)"
                :title="isLocked(p.name) ? 'Locked while playing' : undefined"
                class="w-20 border border-(--border-strong) bg-(--surface-sunken) px-1.5 py-0.5 font-mono text-(length:--sketch-font-size-micro) disabled:cursor-not-allowed disabled:opacity-40"
                @change="commit(p.name, ($event.target as HTMLInputElement).value)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
        </label>
    </div>
</template>
