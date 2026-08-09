<script setup lang="ts">
/* Sketch workspace - the three-pane 1a layout. Tab edits buffer locally
   and write to the store on a 500ms debounce so the SAVED label ticks
   the way the spec describes; aspect and rename write straight through.
   RUN is chrome only until the runner lands. */
import { byRecency, relativeTimeLabel, type SketchAspect } from '~/utils/sketch/model';

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

function run() {
    // chunk 5: evaluate the sketch, fill the output strip and transport
}
function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        run();
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
            <SketchCodePane v-model:code="code" v-model:maths="maths" v-model:notes="notes" :language="sketch.language" />
            <SketchCanvasPane v-model:aspect="aspect" :preferred-ratio="sketch.preferredRatio" />
        </div>
        <SketchTransport v-if="sketch" />
    </SketchShell>
</template>
