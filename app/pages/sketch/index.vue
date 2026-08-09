<script setup lang="ts">
/* Sketch library, doubling as the empty state (screen 2)
   when nothing is on the bench. The whole viewport is a drop target; a
   dropped audio file currently just seeds a named sketch. */
import { byRecency, languageCounts, type Sketch, type SketchLanguage } from '~/utils/sketch/model';
import type { SketchStarter } from '~/utils/sketch/starters';

useSeoMeta({ title: 'Sketch' });

const router = useRouter();
const store = useSketchStore();

type Filter = 'all' | SketchLanguage;
const LANGUAGES: readonly SketchLanguage[] = ['js', 'tex'];
const filter = ref<Filter>('all');
const sort = ref<'recent' | 'name'>('recent');

const counts = computed(() => languageCounts(store.sketches.value));
const visible = computed<Sketch[]>(() => {
    const matching = store.sketches.value.filter((s) => filter.value === 'all' || s.language === filter.value);
    return sort.value === 'recent' ? byRecency(matching) : [...matching].sort((a, b) => a.name.localeCompare(b.name));
});

/* Relative-time labels tick without per-card timers. */
const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
    tick = setInterval(() => (now.value = Date.now()), 30_000);
});
onUnmounted(() => clearInterval(tick));

function open(sketch: Sketch) {
    router.push(`/sketch/${sketch.id}`);
}

function createAndOpen(seed: Parameters<typeof store.create>[0] = {}) {
    open(store.create(seed));
}

function fromStarter(starter: SketchStarter) {
    createAndOpen(starter.seed);
}

function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createAndOpen();
    }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

/* Viewport drop target. dragenter/leave pair-count so children don't
   flicker the state off. */
const dragDepth = ref(0);
const dragActive = computed(() => dragDepth.value > 0);
function onDrop(e: DragEvent) {
    dragDepth.value = 0;
    const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('audio/'));
    if (file) createAndOpen({ name: file.name.replace(/\.[^.]+$/, '') });
}
</script>

<template>
    <SketchShell compact>
        <template #identity>
            <span class="font-mono text-caption tracking-label text-(--text-muted)">/ SKETCHES</span>
        </template>
        <template #actions>
            <DsButton variant="sketch-primary" size="sm" @click="createAndOpen()">New ⌘N</DsButton>
        </template>

        <div
            class="flex min-h-0 flex-1 flex-col"
            @dragenter.prevent="dragDepth++"
            @dragleave.prevent="dragDepth--"
            @dragover.prevent
            @drop.prevent="onDrop"
        >
            <template v-if="store.sketches.value.length">
                <div class="flex items-center gap-2.5 border-b border-(--border) px-4 py-3">
                    <span
                        class="font-mono text-(length:--sketch-font-size-micro) tracking-label-wide text-(--text-muted) uppercase"
                    >
                        Filter
                    </span>
                    <button
                        v-for="pill in [
                            { value: 'all' as Filter, label: `ALL ${store.sketches.value.length}` },
                            ...LANGUAGES.map((l) => ({
                                value: l as Filter,
                                label: `${l.toUpperCase()} ${counts[l] ?? 0}`,
                            })),
                        ]"
                        :key="pill.value"
                        type="button"
                        class="cursor-pointer px-2.5 py-1.5 font-mono text-(length:--sketch-font-size-micro) tracking-(--sketch-tracking-tight)"
                        :class="
                            filter === pill.value
                                ? 'bg-(--border-strong) text-(--surface-elevated)'
                                : 'border border-(--border) transition-colors duration-(--motion-duration-fast) hover:bg-(--bg)'
                        "
                        @click="filter = pill.value"
                    >
                        {{ pill.label }}
                    </button>
                    <div class="flex-1" />
                    <button
                        type="button"
                        class="cursor-pointer font-mono text-(length:--sketch-font-size-micro) tracking-label text-(--text-muted) uppercase"
                        @click="sort = sort === 'recent' ? 'name' : 'recent'"
                    >
                        Sort · {{ sort === 'recent' ? 'Recent' : 'Name' }} ▾
                    </button>
                </div>

                <div
                    class="sketch-grid-dots grid flex-1 content-start gap-3.5 overflow-y-auto p-4 py-[18px] min-[600px]:grid-cols-2 min-[900px]:grid-cols-3"
                    :class="dragActive && 'bg-(--accent)/12'"
                >
                    <SketchCard
                        v-for="sketch in visible"
                        :key="sketch.id"
                        :sketch="sketch"
                        :now="now"
                        @open="open(sketch)"
                        @rename="(name) => store.rename(sketch.id, name)"
                        @duplicate="store.duplicate(sketch.id)"
                        @remove="store.remove(sketch.id)"
                    />
                </div>
            </template>

            <div
                v-else
                class="sketch-grid-dots grid flex-1 place-items-center p-6"
                :class="dragActive && 'bg-(--accent)/12'"
            >
                <SketchEmptyState :drag-active="dragActive" @create="createAndOpen()" @starter="fromStarter" />
            </div>
        </div>
    </SketchShell>
</template>
