<script setup lang="ts">
/* Sketch workspace. The three-pane 1a layout. WIP; for now
   the shell resolves the sketch from the route so the header identity
   cluster has real data behind it. */
const route = useRoute();
const { get } = useSketchStore();
const sketch = computed(() => get(route.params.id as string));

useSeoMeta({ title: () => (sketch.value ? `${sketch.value.name} - Sketch` : 'Sketch') });
</script>

<template>
    <SketchShell>
        <template #identity>
            <div class="h-[26px] w-px shrink-0 bg-(--border)" />
            <span class="text-heading font-semibold whitespace-nowrap">{{ sketch?.name ?? 'untitled' }}</span>
        </template>
        <div class="sketch-grid-dots grid flex-1 place-items-center">
            <span
                class="font-mono text-(length:--sketch-font-size-micro) tracking-label-wide text-(--text-muted) uppercase"
            >
                Workspace - chunk 4
            </span>
        </div>
    </SketchShell>
</template>
