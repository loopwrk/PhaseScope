<script setup lang="ts">
type AsyncFileHandler = (file: File) => Promise<void>;

interface Props {
  disabled?: boolean;
  accept?: string;
  handler?: AsyncFileHandler;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  accept: 'audio/*',
  handler: undefined,
});

const emit = defineEmits<{
  load: [file: File];
  success: [];
  error: [error: Error];
}>();

const fileInputId = useId();
const isLoading = ref(false);

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // Reset the input so the same file can be selected again
  target.value = '';

  emit('load', file);

  if (props.handler) {
    isLoading.value = true;
    try {
      await props.handler(file);
      emit('success');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load audio file');
      console.error('Audio load error:', error);
      emit('error', error);
    } finally {
      isLoading.value = false;
    }
  }
};

const isDisabled = computed(() => props.disabled || isLoading.value);
</script>

<template>
  <div class="inline-block">
    <input :id="fileInputId" type="file" :accept="accept" class="hidden" :disabled="isDisabled"
      @change="handleFileChange" />

    <UButton as="label" :for="fileInputId" color="primary" size="lg" :loading="isLoading"
      leading-icon="i-heroicons-arrow-up-tray" :class="{ 'cursor-not-allowed opacity-50': isDisabled }">
      <slot :loading="isLoading">
        {{ isLoading ? 'Loading...' : 'Load Audio' }}
      </slot>
    </UButton>
  </div>
</template>
