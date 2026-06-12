<script setup lang="ts">
/* ControlsOverlay - glass HUD that floats over the live canvas. Top half is
   LIVE + interactive (camera mode, movement speed, WASD activity reflecting the
   engine state); the lower half is a static keyboard reference. Controlled: the
   parent owns engine state and applies the changes. */
import KeyCap from '../ds/KeyCap.vue';
import IconButton from '../ds/IconButton.vue';
import Panel from '../ds/Panel.vue';

import { segBaseSm as segBase, segActive, segIdle } from '../ds/segmented';

type CameraMode = 'free' | 'follow' | 'orbit';

withDefaults(
    defineProps<{
        cameraMode?: CameraMode;
        speedIndex?: number; // 0 slow / 1 medium / 2 fast
        moving?: boolean; // any WASD / arrow / space movement key down
        disabled?: boolean; // camera + speed need audio loaded
    }>(),
    { cameraMode: 'orbit', speedIndex: 1, moving: false, disabled: false }
);

const emit = defineEmits<{ setCameraMode: [mode: CameraMode]; setSpeed: [index: number]; close: [] }>();

const cameraModes: { label: string; value: CameraMode }[] = [
    { label: 'Free', value: 'free' },
    { label: 'Follow', value: 'follow' },
    { label: 'Orbit', value: 'orbit' },
];
const speeds = ['Slow', 'Med', 'Fast'];
</script>

<template>
    <Panel variant="glass" title="Controls" class="w-[min(100vw_-_2rem,17rem)]">
        <template #headerRight>
            <IconButton
                icon="i-lucide-x"
                variant="ghost"
                class="mr-0"
                size="sm"
                aria-label="Hide overlay"
                @click="emit('close')"
            />
        </template>
        <div class="flex flex-col gap-4">
            <!-- Camera mode (live + interactive) -->
            <div class="flex flex-col gap-2" :class="{ 'pointer-events-none opacity-40': disabled }">
                <div class="flex items-center justify-between">
                    <span class="ps-label text-(--brand-white)">Camera</span>
                    <KeyCap label="C" />
                </div>
                <div role="group" aria-label="Camera mode" class="grid grid-cols-3 gap-1">
                    <button
                        v-for="m in cameraModes"
                        :key="m.value"
                        type="button"
                        :disabled="disabled"
                        :class="[segBase, cameraMode === m.value ? segActive : segIdle]"
                        :aria-pressed="cameraMode === m.value"
                        @click="emit('setCameraMode', m.value)"
                    >
                        {{ m.label }}
                    </button>
                </div>
            </div>

            <!-- Movement speed (live + interactive) -->
            <div class="flex flex-col gap-2" :class="{ 'pointer-events-none opacity-40': disabled }">
                <div class="flex items-center justify-between">
                    <span class="ps-label text-(--brand-white)">Speed</span>
                    <span class="flex gap-1"><KeyCap label="[" /><KeyCap label="]" /></span>
                </div>
                <div role="group" aria-label="Movement speed" class="grid grid-cols-3 gap-1">
                    <button
                        v-for="(s, i) in speeds"
                        :key="s"
                        type="button"
                        :disabled="disabled"
                        :class="[segBase, speedIndex === i ? segActive : segIdle]"
                        :aria-pressed="speedIndex === i"
                        @click="emit('setSpeed', i)"
                    >
                        {{ s }}
                    </button>
                </div>
            </div>

            <!-- Movement keys (WASD pad lights up while moving) -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <span class="ps-label text-(--brand-white)">Move</span>
                    <span
                        class="inline-flex items-center gap-1.5 font-mono text-caption uppercase tracking-label"
                        :class="moving ? 'text-(--accent)' : 'text-(--brand-white)'"
                    >
                        <span
                            class="size-1.5"
                            :class="moving ? 'bg-(--accent) shadow-(--shadow-glow-accent)' : 'bg-(--border-strong)'"
                        />
                        {{ moving ? 'Active' : 'Idle' }}
                    </span>
                </div>
                <div class="flex flex-col items-center gap-1.5">
                    <KeyCap label="W" size="lg" :accent="moving" />
                    <div class="flex gap-1.5">
                        <KeyCap label="A" size="lg" :accent="moving" />
                        <KeyCap label="S" size="lg" :accent="moving" />
                        <KeyCap label="D" size="lg" :accent="moving" />
                    </div>
                    <!-- Vertical flight: words beat glyphs for instant parsing;
                     the pair sits centred under WASD so the cluster balances -->
                    <div class="flex items-start justify-center gap-5 pt-2">
                        <span class="flex flex-col items-center gap-1">
                            <KeyCap label="SHIFT" size="lg" />
                            <span class="font-mono text-caption uppercase tracking-label text-(--text-muted)"
                                >Down</span
                            >
                        </span>
                        <span class="flex flex-col items-center gap-1">
                            <KeyCap label="SPACE" size="lg" />
                            <span class="font-mono text-caption uppercase tracking-label text-(--text-muted)">Up</span>
                        </span>
                    </div>
                </div>
            </div>

            <!-- The way back: H re-opens what H (or the X) hides -->
            <div class="flex items-center gap-3 border-t border-(--border) pt-3">
                <KeyCap label="H" />
                <span class="text-detail text-(--brand-white)">Hide this panel</span>
            </div>
        </div>
    </Panel>
</template>
