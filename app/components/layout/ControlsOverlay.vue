<script setup lang="ts">
/* ControlsOverlay - glass HUD that floats over the live canvas. Top half is
   LIVE + interactive (camera mode, movement speed, WASD activity reflecting the
   engine state); the lower half is a static keyboard reference. Controlled: the
   parent owns engine state and applies the changes. */
import KeyCap from '../ds/KeyCap.vue';
import IconButton from '../ds/IconButton.vue';

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

// Static reference (Camera + Speed live above; tracks use { } - [ ] is speed).
const sections: { label: string; keys: { k: string; d: string }[] }[] = [
    {
        label: 'Playback',
        keys: [
            { k: 'ENTER ↵', d: 'Play / pause' },
            { k: 'R', d: 'Render mode' },
            { k: 'O', d: 'Point oscillation' },
        ],
    },
    {
        label: 'View',
        keys: [
            { k: 'V', d: 'Reverse colour spectrum' },
            { k: 'B', d: 'Dream background' },
            { k: 'N', d: 'Heavenly background' },
            { k: 'G', d: 'Goniometer' },
            { k: 'H', d: 'Toggle this overlay' },
        ],
    },
    {
        label: 'Tracks',
        keys: [
            { k: '{', d: 'Previous track' },
            { k: '}', d: 'Next track' },
        ],
    },
];
</script>

<template>
    <aside class="ps-glass flex w-[min(100vw_-_2rem,17rem)] flex-col gap-4 p-4 [clip-path:var(--clip-chamfer-md)]">
        <div class="flex items-center justify-between">
            <p class="ps-label">Controls</p>
            <IconButton icon="i-lucide-x" variant="ghost" size="sm" aria-label="Hide overlay" @click="emit('close')" />
        </div>

        <!-- Camera mode (live + interactive) -->
        <div class="flex flex-col gap-2" :class="{ 'pointer-events-none opacity-40': disabled }">
            <div class="flex items-center justify-between">
                <span class="ps-label text-(--text-faint)">Camera</span>
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
                <span class="ps-label text-(--text-faint)">Speed</span>
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
                <span class="ps-label text-(--text-faint)">Move</span>
                <span
                    class="inline-flex items-center gap-1.5 font-mono text-caption uppercase tracking-label"
                    :class="moving ? 'text-(--accent)' : 'text-(--text-faint)'"
                >
                    <span
                        class="size-1.5"
                        :class="moving ? 'bg-(--accent) shadow-(--shadow-glow-accent)' : 'bg-(--border-strong)'"
                    />
                    {{ moving ? 'Active' : 'Idle' }}
                </span>
            </div>
            <div class="flex flex-col items-center gap-1">
                <KeyCap label="W" :accent="moving" />
                <div class="flex gap-1">
                    <KeyCap label="A" :accent="moving" />
                    <KeyCap label="S" :accent="moving" />
                    <KeyCap label="D" :accent="moving" />
                </div>
            </div>
            <div class="flex flex-col gap-1.5 pt-1">
                <div class="flex items-center gap-3">
                    <span class="flex w-14 gap-1"><KeyCap label="↑" /><KeyCap label="↓" /></span>
                    <span class="text-detail text-(--text-muted)">Rise / fall</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="flex w-14 gap-1"><KeyCap label="←" /><KeyCap label="→" /></span>
                    <span class="text-detail text-(--text-muted)">Turn</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="flex w-14 gap-1"><KeyCap label="␣" /><KeyCap label="⇧" /></span>
                    <span class="text-detail text-(--text-muted)">Up / down</span>
                </div>
            </div>
        </div>

        <!-- Static keyboard reference -->
        <div class="flex flex-col gap-3 border-t border-(--border) pt-3">
            <div v-for="s in sections" :key="s.label" class="flex flex-col gap-2">
                <p class="ps-label text-(--text-faint)">{{ s.label }}</p>
                <div v-for="row in s.keys" :key="row.k" class="flex items-center gap-3">
                    <KeyCap :label="row.k" />
                    <span class="text-detail text-(--text-muted)">{{ row.d }}</span>
                </div>
            </div>
        </div>
    </aside>
</template>
