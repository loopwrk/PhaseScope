<script setup lang="ts">
withDefaults(defineProps<{ size?: 'lg' | 'md' | 'sm' }>(), { size: 'md' });

const box = { lg: 'size-[30px]', md: 'size-[26px]', sm: 'size-[22px]' };
</script>

<template>
    <div class="grid shrink-0 place-items-center border border-(--border-strong) bg-(--accent)" :class="box[size]">
        <div
            v-if="size === 'lg'"
            class="size-3.5 rounded-full border-2 border-(--border-strong) border-t-transparent"
        />
    </div>
</template>
