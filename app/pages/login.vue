<script setup lang="ts">
definePageMeta({
    layout: 'default',
});

const { login, checkAuth } = useSimpleAuth();
const password = ref('');
const error = ref(false);

// If already authenticated, redirect to home
onMounted(() => {
    if (checkAuth()) {
        navigateTo('/serpent');
    }
});

const handleSubmit = () => {
    error.value = false;
    if (login(password.value)) {
        navigateTo('/serpent');
    } else {
        error.value = true;
        password.value = '';
    }
};
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-100">
        <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
            <h1 class="text-2xl font-bold text-center text-primary mb-6">Phasefold</h1>
            <p class="text-gray-600 text-center mb-6">Enter password</p>

            <form @submit.prevent="handleSubmit" class="space-y-4">
                <UInput
                    v-model="password"
                    type="password"
                    placeholder="Password"
                    size="lg"
                    autofocus
                    :ui="{ base: 'w-full' }"
                />

                <p v-if="error" class="text-red-500 text-sm text-center">Incorrect password</p>

                <UButton type="submit" color="primary" size="lg" block> Enter </UButton>
            </form>
        </div>
    </div>
</template>
