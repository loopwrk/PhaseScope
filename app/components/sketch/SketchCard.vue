<script setup lang="ts">
/* Thumbnail is the sketch's captured last
   frame when one exists; until the runner lands that is null,
   so the language falls back as the centred kind label. Context actions
   sit behind a hover/focus ⋯ menu; rename swaps the name line for an
   inline input so the card never changes shape. */
import { nextTick, ref } from 'vue';
import Badge from '../ds/Badge.vue';
import IconButton from '../ds/IconButton.vue';
import type { Sketch } from '~/utils/sketch/model';
import { relativeTimeLabel } from '~/utils/sketch/model';

const props = defineProps<{ sketch: Sketch; now: number }>();
const emit = defineEmits<{
    open: [];
    rename: [name: string];
    duplicate: [];
    remove: [];
}>();

const menuOpen = ref(false);
const renaming = ref(false);
const nameDraft = ref('');
const nameInput = ref<HTMLInputElement>();

function startRename() {
    menuOpen.value = false;
    renaming.value = true;
    nameDraft.value = props.sketch.name;
    nextTick(() => nameInput.value?.select());
}

function commitRename() {
    if (!renaming.value) return;
    renaming.value = false;
    if (nameDraft.value.trim() && nameDraft.value !== props.sketch.name) emit('rename', nameDraft.value);
}

function menuAction(action: 'duplicate' | 'remove') {
    menuOpen.value = false;
    emit(action);
}
</script>

<template>
    <article
        class="group relative border border-(--border-strong) bg-(--surface-elevated) transition-shadow duration-(--motion-duration-fast) hover:shadow-(--sketch-shadow-card-sm) focus-within:shadow-(--sketch-shadow-card-sm)"
    >
        <button
            type="button"
            class="block w-full cursor-pointer text-left"
            :aria-label="`Open ${sketch.name}`"
            @click="emit('open')"
        >
            <div
                class="grid h-24 place-items-center overflow-hidden border-b border-(--border-strong) bg-(--surface-sunken)"
            >
                <img v-if="sketch.thumbnail" :src="sketch.thumbnail" alt="" class="h-full w-full object-cover" />
                <span
                    v-else
                    class="font-mono text-(length:--sketch-font-size-nano) tracking-(--sketch-tracking-wide) text-(--text-faint) uppercase"
                >
                    {{ sketch.language }}
                </span>
            </div>
            <div class="flex flex-col gap-1.5 p-2.5 px-3">
                <span v-if="!renaming" class="text-body font-semibold">{{ sketch.name }}</span>
                <div class="flex items-center gap-2">
                    <Badge sketch size="sm" :label="sketch.language" />
                    <span
                        class="font-mono text-(length:--sketch-font-size-nano) tracking-label text-(--text-muted) uppercase"
                    >
                        {{ relativeTimeLabel(sketch.updatedAt, now) }}
                    </span>
                </div>
            </div>
        </button>

        <input
            v-if="renaming"
            ref="nameInput"
            v-model="nameDraft"
            class="absolute inset-x-3 bottom-9 border border-(--border-strong) bg-(--surface-sunken) px-1 text-body font-semibold"
            @keydown.enter="commitRename"
            @keydown.esc="renaming = false"
            @blur="commitRename"
        />

        <div
            class="absolute right-1.5 bottom-8 opacity-0 transition-opacity duration-(--motion-duration-fast) group-hover:opacity-100 focus-within:opacity-100"
        >
            <IconButton
                icon="i-lucide-ellipsis"
                variant="sketch"
                size="xs"
                :aria-label="`Actions for ${sketch.name}`"
                @click="menuOpen = !menuOpen"
            />
        </div>

        <menu
            v-if="menuOpen"
            class="absolute right-1.5 bottom-16 z-10 m-0 flex list-none flex-col border border-(--border-strong) bg-(--surface-elevated) p-0 shadow-(--sketch-shadow-card-sm)"
            @mouseleave="menuOpen = false"
        >
            <li v-for="item in ['rename', 'duplicate', 'delete'] as const" :key="item">
                <button
                    type="button"
                    class="w-full cursor-pointer px-3 py-1.5 text-left font-mono text-(length:--sketch-font-size-micro) tracking-label uppercase hover:bg-(--bg)"
                    :class="item === 'delete' && 'text-(--error)'"
                    @click="item === 'rename' ? startRename() : menuAction(item === 'delete' ? 'remove' : item)"
                >
                    {{ item }}
                </button>
            </li>
        </menu>
    </article>
</template>
