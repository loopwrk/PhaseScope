<script setup lang="ts">
/* SourcePicker - the "no signal" landing where you choose the signal
   source: two doors into the same hall. Listen loads a track (a file of
   your own, or a demo via the parent's picker); Play opens the live
   session card. Owns its hidden file input; the parent positions the
   picker and decides what each door opens onto. */
import { ref } from 'vue';
import Logo from '../ds/Logo.vue';
import Button from '../ds/Button.vue';

const emit = defineEmits<{
    loadFile: [file: File];
    pickDemo: [];
    goLive: [];
}>();

// The doors' shared button costume (hoisted - it read three times over)
const DOOR_BUTTON_CLASS = 'mr-0 py-2 ring-(--brand-primary) text-(--brand-white)';

const fileInput = ref<HTMLInputElement | null>(null);
const onFile = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) emit('loadFile', file);
    input.value = '';
};
</script>

<template>
    <div class="flex flex-col items-center justify-center gap-7">
        <Logo :size="56" mono class="text-(--text-muted)" />
        <p class="ps-label">No signal</p>
        <div class="flex flex-col gap-4 sm:flex-row">
            <div
                class="ps-glass flex w-60 flex-col items-center gap-2 border border-(--border-strong) px-6 py-5 [clip-path:var(--clip-notch)]"
            >
                <UIcon name="i-lucide-headphones" class="size-7 text-(--accent)" />
                <span class="font-display text-body font-semibold">Listen</span>
                <div class="mx-auto mt-1 flex w-fit flex-col items-stretch gap-2">
                    <Button
                        variant="secondary"
                        :class="DOOR_BUTTON_CLASS"
                        size="md"
                        icon="i-lucide-upload"
                        label="Load audio"
                        @click="fileInput?.click()"
                    />
                    <Button
                        variant="secondary"
                        :class="DOOR_BUTTON_CLASS"
                        size="md"
                        icon="i-lucide-disc-3"
                        label="Pick a demo"
                        @click="emit('pickDemo')"
                    />
                </div>
            </div>
            <div
                class="ps-glass flex w-60 flex-col items-center gap-2 border border-(--border-strong) px-6 py-5 [clip-path:var(--clip-notch)]"
            >
                <UIcon name="i-lucide-keyboard-music" class="size-7 text-(--accent)" />
                <span class="font-display text-body font-semibold">Play</span>
                <span class="text-caption text-center text-(--text-muted)"
                    >Play with a MIDI keyboard or on-screen keys</span
                >
                <div class="mx-auto mt-1 flex w-fit flex-col items-stretch">
                    <Button
                        variant="secondary"
                        :class="DOOR_BUTTON_CLASS"
                        size="md"
                        icon="i-lucide-keyboard-music"
                        label="Go live"
                        @click="emit('goLive')"
                    />
                </div>
            </div>
        </div>
        <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="onFile" />
    </div>
</template>
