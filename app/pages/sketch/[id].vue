<script setup lang="ts">
/* Sketch workspace - the three-pane 1a layout. Tab edits buffer locally
   and write to the store on a 500ms debounce so the SAVED label ticks
   the way the spec describes; aspect and rename write straight through.
   RUN is chrome only until the runner lands. */
import { useMediaQuery } from '@vueuse/core';
import { byRecency, relativeTimeLabel, type SketchAspect } from '~/utils/sketch/model';
import { runSketch, type RenderFrame } from '~/utils/sketch/runner';
import { extractParamRecord } from '~/utils/sketch/params';
import { LOCKED_WHILE_PLAYING } from '~/utils/sketch/param-ranges';

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

/* Below 900px the three regions stack (spec screen 4) and header
   actions move into the ≡ sheet. */
const isMobile = useMediaQuery('(max-width: 899px)');
const sheetOpen = ref(false);

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

/* The maths-tab assignments, as the runner reads them. Frozen so a
   sketch can't write back into the workspace's own state, and computed
   so the copy is rebuilt when the maths changes rather than per frame -
   the render loop reads this many times a second. */
const liveParams = computed(() => Object.freeze(extractParamRecord(maths.value)));

/* A buffer sketch generates its audio once per RUN and plays it as-is, so
   unlike the canvas it cannot follow a param edit. Remember what the
   loaded buffer was made from; anything else on screen means the
   transport is playing something the sketch no longer describes.

   A live sketch has no such gap - params reach the audio thread as they
   change - so only a code edit can put it out of date. */
const audioSignature = ref<string | null>(null);
function sketchSignature(): string {
    return player.isLive.value ? code.value : JSON.stringify([code.value, liveParams.value]);
}
const audioStale = computed(() => audioSignature.value !== null && audioSignature.value !== sketchSignature());

/* The canvas moves with the sound: while it plays, and while it loops.
   Pause or stop and it freezes on the frame it reached, still on screen.
   A sketch with no audio has nothing to follow, so it just runs. */
const animating = computed(() => player.playState.value === 'playing' || player.duration.value === 0);

/* Held only while sound is coming out - paused and stopped both free it. */
const lockedParams = computed(() => (player.playState.value === 'playing' ? LOCKED_WHILE_PLAYING : []));

async function run() {
    if (!sketch.value) return;
    const result = await runSketch(
        sketch.value.language,
        code.value,
        player.ensureSampleRate(),
        () => liveParams.value
    );
    lastRun.value = { ok: result.ok, message: result.message };
    if (!result.ok) return;
    if (result.live) {
        await player.loadLive(result.live, liveParams.value);
        audioSignature.value = sketchSignature();
        void player.play();
    } else if (result.channels) {
        player.load(result.channels);
        audioSignature.value = sketchSignature();
        void player.play();
    }
    renderFrame.value = result.renderFrame;
    rendering.value = Boolean(result.renderFrame);
}

/* The one line that makes a value editable mid-note: every param change
   goes straight to the audio thread. Ignored for buffer sketches. */
watch(liveParams, (params) => player.setLiveParams(params));

/* A live voice that throws cannot fail the run - it was already playing. */
watch(
    () => player.liveError.value,
    (message) => {
        if (message) lastRun.value = { ok: false, message: `live: ${message}` };
    }
);

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
        <template v-if="isMobile" #header>
            <header
                class="relative flex items-center gap-2.5 border-b border-(--border-strong) bg-(--surface-elevated) px-3.5 py-3"
            >
                <SketchMark size="sm" />
                <span class="truncate text-body font-semibold">{{ sketch?.name }}</span>
                <div class="flex-1" />
                <button
                    type="button"
                    class="min-h-9 min-w-11 cursor-pointer border border-(--border-strong) px-2 text-body"
                    aria-label="Menu"
                    :aria-expanded="sheetOpen"
                    @click="sheetOpen = !sheetOpen"
                >
                    ≡
                </button>
                <menu
                    v-if="sheetOpen"
                    class="absolute inset-x-0 top-full z-30 m-0 flex list-none flex-col border-b border-(--border-strong) bg-(--surface-elevated) p-0 shadow-(--sketch-shadow-card-sm)"
                >
                    <li v-for="s in recent" :key="s.id">
                        <button
                            type="button"
                            class="min-h-11 w-full cursor-pointer truncate px-3.5 text-left text-body hover:bg-(--surface)"
                            :class="s.id === sketch?.id && 'font-semibold'"
                            @click="sheetOpen = false; openSketch(s.id)"
                        >
                            {{ s.name }}
                        </button>
                    </li>
                    <li class="flex min-h-11 items-center gap-3 border-t border-(--border) px-3.5">
                        <span
                            class="font-mono text-(length:--sketch-font-size-micro) tracking-label-wide text-(--text-muted) uppercase"
                        >
                            Aspect
                        </span>
                        <DsSegmentedControl
                            v-model="aspect"
                            :options="[
                                { value: 'fit', label: 'Fit' },
                                { value: '16:9', label: '16:9' },
                                { value: '1:1', label: '1:1' },
                                { value: 'free', label: 'Free' },
                            ]"
                            size="sm"
                        />
                    </li>
                    <li class="border-t border-(--border)">
                        <button
                            type="button"
                            class="min-h-11 w-full cursor-pointer bg-(--accent) px-3.5 text-left font-mono text-caption font-semibold tracking-label uppercase hover:bg-(--sketch-accent-hover)"
                            @click="sheetOpen = false; run()"
                        >
                            Run ⏎
                        </button>
                    </li>
                    <li class="border-t border-(--border)">
                        <NuxtLink
                            to="/"
                            class="flex min-h-11 items-center px-3.5 font-mono text-(length:--sketch-font-size-micro) tracking-label text-(--text-muted) uppercase no-underline hover:no-underline"
                        >
                            ↩ Phasescope
                        </NuxtLink>
                    </li>
                </menu>
            </header>
        </template>

        <template v-if="!isMobile" #identity>
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

        <template v-if="!isMobile" #actions>
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

        <template v-if="sketch && isMobile">
            <SketchCanvasPane
                v-model:aspect="aspect"
                v-model:maths="maths"
                :locked-params="lockedParams"
                compact
                :preferred-ratio="sketch.preferredRatio"
                :render-frame="renderFrame"
                :running="rendering"
                :animating="animating"
                :repaint-key="liveParams"
                @capture="onCapture"
                @render-error="onRenderError"
            />
            <SketchTransport
                compact
                :play-state="player.playState.value"
                :playhead="player.playhead.value"
                :duration="player.duration.value"
                :peaks="player.peaks.value"
                :meter="player.meter.value"
                :sample-rate="player.sampleRate.value"
                :channel-count="player.channelCount.value"
                :loop="player.loop"
                :stale="audioStale"
                @play="player.play()"
                @pause="player.pause()"
                @stop="player.stop()"
                @seek="player.seek($event)"
                @toggle-loop="player.loop.enabled = !player.loop.enabled"
                @set-loop="Object.assign(player.loop, $event)"
            />
            <SketchCodePane
                v-model:code="code"
                v-model:maths="maths"
                v-model:notes="notes"
                :locked-params="lockedParams"
                mobile
                :language="sketch.language"
                :result="lastRun"
                @run="run"
            />
        </template>

        <template v-else-if="sketch">
            <div class="flex min-h-0 flex-1">
                <SketchCodePane
                    v-model:code="code"
                    v-model:maths="maths"
                    v-model:notes="notes"
                    :locked-params="lockedParams"
                    :language="sketch.language"
                    :result="lastRun"
                />
                <SketchCanvasPane
                    v-model:aspect="aspect"
                    v-model:maths="maths"
                    :locked-params="lockedParams"
                    :preferred-ratio="sketch.preferredRatio"
                    :render-frame="renderFrame"
                    :running="rendering"
                    :animating="animating"
                    :repaint-key="liveParams"
                    @capture="onCapture"
                    @render-error="onRenderError"
                />
            </div>
            <SketchTransport
                :play-state="player.playState.value"
                :playhead="player.playhead.value"
                :duration="player.duration.value"
                :peaks="player.peaks.value"
                :meter="player.meter.value"
                :sample-rate="player.sampleRate.value"
                :channel-count="player.channelCount.value"
                :loop="player.loop"
                :stale="audioStale"
                @play="player.play()"
                @pause="player.pause()"
                @stop="player.stop()"
                @seek="player.seek($event)"
                @toggle-loop="player.loop.enabled = !player.loop.enabled"
                @set-loop="Object.assign(player.loop, $event)"
            />
        </template>
    </SketchShell>
</template>
