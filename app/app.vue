<template>
    <UApp>
        <SkipLink />
        <NuxtLayout>
            <NuxtPage />
        </NuxtLayout>
    </UApp>
</template>

<script setup lang="ts">
const colorMode = useColorMode();
onMounted(() => {
    colorMode.preference = 'dark';
});
</script>
