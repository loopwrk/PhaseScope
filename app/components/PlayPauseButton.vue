<script setup lang="ts">
import { useElementHover } from '@vueuse/core'

const props = withDefaults(
    defineProps<{
        showPauseWhenPlaying?: boolean,
        animateOnPlay?: boolean,
        isPlaying?: boolean,
        disabled?: boolean,
    }>(),
    {
        showPauseWhenPlaying: true,
        animateOnPlay: true,
        isPlaying: undefined,
        disabled: false,
    }
)

const emit = defineEmits<{
    click: []
}>()

const buttonId = useId();

const play = usePlayAudio();

// Only show as playing if:
// 1. External isPlaying prop is provided (serpent.vue case), OR
// 2. This button is the active one AND playback is happening (home page case)
const isCurrentlyPlaying = computed(() => {
    if (props.isPlaying !== undefined) {
        return props.isPlaying;
    }
    return play.isCurrentlyPlaying.value && play.activePlayButtonId.value === buttonId;
})

const showingPauseIcon = computed(() => isCurrentlyPlaying.value && props.showPauseWhenPlaying);

const ariaLabel = computed(() => showingPauseIcon.value ? 'Pause' : 'Play');

const el = useTemplateRef('el')
const isHovered = useElementHover(el)
const handleClick = () => {
    if (props.disabled) return;
    play.activePlayButtonId.value = buttonId;
    emit('click')
}
</script>

<template>
    <div class="play-pause-button-container">
        <button ref="el" class="play-pause-button w-16 h-24 mr-8 flex items-center justify-center"
            :class="[disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer']" :disabled="disabled"
            :aria-label="ariaLabel" :aria-pressed="isCurrentlyPlaying" @click="handleClick">
            <UIcon name="mingcute-play-fill" class="transition-opacity duration-0" :class="[
                disabled ? 'bg-gray-400' : 'bg-accessible-blue',
                isHovered && !disabled ? 'size-17' : 'size-14',
                showingPauseIcon ? 'opacity-0 absolute' : 'opacity-100'
            ]" />

            <UIcon name="mingcute-pause-fill" class="transition-opacity duration-0" :class="[
                disabled ? 'bg-gray-400' : 'bg-accessible-blue',
                showingPauseIcon && animateOnPlay ? 'liquid-wheel' : '',
                isHovered && !disabled ? 'size-17' : 'size-14',
                showingPauseIcon ? 'opacity-100' : 'opacity-0 absolute'
            ]" />
        </button>
    </div>
</template>
