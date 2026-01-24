<script setup lang="ts">
import { useElementHover } from '@vueuse/core'

const props = withDefaults(
    defineProps<{
        disabled?: boolean,
    }>(),
    {
        disabled: false,
    }
)

const emit = defineEmits<{
    click: []
}>()

const el = useTemplateRef('el')
const isHovered = useElementHover(el)

const handleClick = () => {
    if (props.disabled) return;
    emit('click')
}
</script>

<template>
    <div class="stop-button-container">
        <button ref="el" class="stop-button w-16 h-24 mr-8 flex items-center justify-center"
            :class="[disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer']" :disabled="disabled"
            aria-label="Stop" @click="handleClick">
            <UIcon name="mingcute-stop-fill"
                :class="[
                    disabled ? 'bg-gray-400' : 'bg-accessible-blue',
                    isHovered && !disabled ? 'size-17' : 'size-14'
                ]" />
        </button>
    </div>
</template>
