<template>
  <UApp>
    <SkipLink />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { useFavicon } from "@vueuse/core";

const icon = useFavicon();
const colorMode = useColorMode();

onMounted(() => {
  icon.value = "/favicon-light.ico";
  colorMode.preference = "light";
  colorMode.value = "light";
});
</script>
