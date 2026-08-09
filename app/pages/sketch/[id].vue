<script setup lang="ts">
/* Sketch workspace - the three-pane 1a layout. Tab edits buffer locally
   and write to the store on a 500ms debounce so the SAVED label ticks
   the way the spec describes; aspect and rename write straight through.
   RUN is chrome only until the runner lands. */
import { byRecency, relativeTimeLabel, type SketchAspect } from '~/utils/sketch/model';
import { runSketch, type RenderFrame } from '~/utils/sketch/runner';

const route = useRoute();
const router = useRouter();
const store = useSketchStore();
const sketch = computed(() => store.get(route.params.id as string));

/* A bad or deleted id has no workspace - back to the library. */
watchEffect(() => {
    if (import.meta.client && !sketch.value) router.replace('/sketch');
});

useSeoMeta({ title: () => (sketch.value ? `${sketch.value.name} - Sketch` : 'Sketch') });

const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
    tick = setInterval(() => (now.value = Date.now()), 30_000);
});
onUnmounted(() => clearInterval(tick));

/* Local tab buffers -> debounced store writes. */
const code = ref(sketch.value?.tabs.code ?? '');
const maths = ref(sketch.value?.tabs.maths ?? '');
const notes = ref(sketch.value?.tabs.notes ?? '');
let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch([code, maths, notes], () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        if (!sketch.value) return;
        store.update(sketch.value.id, { tabs: { code: code.value, maths: maths.value, notes: notes.value } });
        now.value = Date.now();
    }, 500);
});
onUnmounted(() => clearTimeout(saveTimer));

const aspect = computed({
    get: () => sketch.value?.aspect ?? 'fit',
    set: (value: SketchAspect) => sketch.value && store.update(sketch.value.id, { aspect: value }),
});

/* Inline rename in the header. */
const renaming = ref(false);
const nameDraft = ref('');
const nameInput = ref<HTMLInputElement>();
function startRename() {
    if (!sketch.value) return;
    renaming.value = true;
    nameDraft.value = sketch.value.name;
    nextTick(() => nameInput.value?.select());
}
function commitRename() {
    if (!renaming.value) return;
    renaming.value = false;
    if (sketch.value && nameDraft.value.trim()) store.rename(sketch.value.id, nameDraft.value);
}

/* SKETCHES dropdown: most recent five, then the library. */
const switcherOpen = ref(false);
const recent = computed(() => byRecency(store.sketches.value).slice(0, 5));
function openSketch(id: string) {
    switcherOpen.value = false;
    router.push(`/sketch/${id}`);
}

/* Run: evaluate the code tab, hand audio to the player and the frame
   function to the canvas. Errors land in the output strip; the canvas
   keeps its last good frame. */
const player = useSketchPlayer();
onUnmounted(() => player.dispose());

const lastRun = ref<{ ok: boolean; message: string } | null>(null);
const renderFrame = shallowRef<RenderFrame>();
const rendering = ref(false);

async function run() {
    if (!sketch.value) return;
    const result = await runSketch(sketch.value.language, code.value, player.ensureSampleRate());
    lastRun.value = { ok: result.ok, message: result.message };
    if (!result.ok) return;
    if (result.channels) {
        player.load(result.channels);
        void player.play();
    }
    renderFrame.value = result.renderFrame;
    rendering.value = Boolean(result.renderFrame);
}

function onRenderError(message: string) {
    rendering.value = false;
    lastRun.value = { ok: false, message: `render: ${message}` };
}

function onCapture(dataUrl: string) {
    if (sketch.value) store.update(sketch.value.id, { thumbnail: dataUrl });
}

/* Space toggles play/pause when focus is outside the editor; L arms
   the loop; Cmd/Ctrl+Enter runs from anywhere. */
function inEditableTarget(e: KeyboardEvent): boolean {
    const el = e.target as HTMLElement | null;
    return Boolean(el?.closest('input, textarea, [contenteditable="true"], .cm-content'));
}
function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void run();
        return;
    }
    if (inEditableTarget(e)) return;
    if (e.key === ' ') {
        e.preventDefault();
        if (player.playState.value === 'playing') void player.pause();
        else if (player.duration.value > 0) void player.play();
    } else if (e.key.toLowerCase() === 'l') {
        player.loop.enabled = !player.loop.enabled;
    }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
    <SketchShell>
        <template #identity>
            <div class="h-[26px] w-px shrink-0 bg-(--border)" />
            <div v-if="sketch" class="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
                <button
                    v-if="!renaming"
                    type="button"
                    class="cursor-text text-heading font-semibold"
                    title="Rename"
                    @click="startRename"
                >
                    {{ sketch.name }}
                </button>
                <input
                    v-else
                    ref="nameInput"
                    v-model="nameDraft"
                    class="border border-(--border-strong) bg-(--surface-sunken) px-1 text-heading font-semibold"
                    :size="Math.max(nameDraft.length, 8)"
                    @keydown.enter="commitRename"
                    @keydown.esc="renaming = false"
                    @blur="commitRename"
                />
                <DsBadge sketch :label="sketch.language" />
                <span class="font-mono text-(length:--sketch-font-size-micro) tracking-label text-(--text-muted) uppercase">
                    Saved {{ relativeTimeLabel(sketch.updatedAt, now) }}
                </span>
            </div>
        </template>

        <template #actions>
            <div class="relative">
                <DsButton variant="sketch-surface" size="sm" @click="switcherOpen = !switcherOpen">Sketches ▾</DsButton>
                <menu
                    v-if="switcherOpen"
                    class="absolute top-full right-0 z-20 m-0 mt-1 flex min-w-44 list-none flex-col border border-(--border-strong) bg-(--surface-elevated) p-0 shadow-(--sketch-shadow-card-sm)"
                    @mouseleave="switcherOpen = false"
                >
                    <li v-for="s in recent" :key="s.id">
                        <button
                            type="button"
                            class="w-full cursor-pointer truncate px-3 py-1.5 text-left text-detail hover:bg-(--surface)"
                            :class="s.id === sketch?.id && 'font-semibold'"
                            @click="openSketch(s.id)"
                        >
                            {{ s.name }}
                        </button>
                    </li>
                    <li class="border-t border-(--border)">
                        <NuxtLink
                            to="/sketch"
                            class="block px-3 py-1.5 font-mono text-(length:--sketch-font-size-micro) tracking-label text-(--text-muted) uppercase no-underline hover:bg-(--surface) hover:no-underline"
                        >
                            All sketches…
                        </NuxtLink>
                    </li>
                </menu>
            </div>
            <DsButton variant="sketch-primary" size="sm" @click="run">Run ⏎</DsButton>
            <div class="h-[26px] w-px bg-(--border)" />
        </template>

        <div v-if="sketch" class="flex min-h-0 flex-1">
            <SketchCodePane
                v-model:code="code"
                v-model:maths="maths"
                v-model:notes="notes"
                :language="sketch.language"
                :result="lastRun"
            />
            <SketchCanvasPane
                v-model:aspect="aspect"
                :preferred-ratio="sketch.preferredRatio"
                :render-frame="renderFrame"
                :running="rendering"
                @capture="onCapture"
                @render-error="onRenderError"
            />
        </div>
        <SketchTransport
            v-if="sketch"
            :play-state="player.playState.value"
            :playhead="player.playhead.value"
            :duration="player.duration.value"
            :peaks="player.peaks.value"
            :meter="player.meter.value"
            :sample-rate="player.sampleRate.value"
            :channel-count="player.channelCount.value"
            :loop="player.loop"
            @play="player.play()"
            @pause="player.pause()"
            @stop="player.stop()"
            @seek="player.seek($event)"
            @toggle-loop="player.loop.enabled = !player.loop.enabled"
            @set-loop="Object.assign(player.loop, $event)"
        />
    </SketchShell>
</template>
