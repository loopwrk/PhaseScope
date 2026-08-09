<script setup lang="ts">
/* Empty-state card (spec screen 2). The page owns the drop target and
   passes dragActive; the card only thickens its border in response. */
import Button from '../ds/Button.vue';
import { SKETCH_STARTERS, type SketchStarter } from '~/utils/sketch/starters';

withDefaults(defineProps<{ dragActive?: boolean }>(), { dragActive: false });
const emit = defineEmits<{ create: []; starter: [starter: SketchStarter] }>();
</script>

<template>
    <section
        class="w-[520px] max-w-full bg-(--surface-elevated) shadow-(--sketch-shadow-card)"
        :class="dragActive ? 'border-2 border-(--border-strong)' : 'border border-(--border-strong)'"
    >
        <header class="border-b border-(--border-strong) px-[18px] py-3.5">
            <h2 class="font-mono text-(length:--sketch-font-size-micro) font-normal tracking-(--sketch-tracking-wide) uppercase">
                New sketch
            </h2>
        </header>
        <div class="flex flex-col gap-[18px] px-[18px] pt-[22px] pb-6">
            <p class="text-title">Nothing on the bench yet. Start from a blank sketch, or open one of the starters.</p>

            <ul class="m-0 flex list-none flex-col gap-px border border-(--border-strong) bg-(--border) p-0">
                <li v-for="starter in SKETCH_STARTERS" :key="starter.label">
                    <button
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-3 bg-(--surface) px-[15px] py-[13px] text-left transition-colors duration-(--motion-duration-fast) hover:bg-(--bg)"
                        @click="emit('starter', starter)"
                    >
                        <span class="w-[34px] shrink-0 font-mono text-caption tracking-label uppercase">
                            {{ starter.language }}
                        </span>
                        <span class="flex-1 text-body">{{ starter.label }}</span>
                        <span class="font-mono text-caption text-(--text-muted)">→</span>
                    </button>
                </li>
            </ul>

            <div class="flex items-center gap-3.5">
                <Button variant="sketch-primary" @click="emit('create')">New sketch ⌘N</Button>
                <span class="font-mono text-caption tracking-label text-(--text-muted) uppercase">
                    or drop an audio file anywhere
                </span>
            </div>
        </div>
    </section>
</template>
