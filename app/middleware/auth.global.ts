export default defineNuxtRouteMiddleware((to) => {
    if (import.meta.server) return;
    if (import.meta.dev) return; // Skip auth in development
    if (to.path === '/login') return;

    const { checkAuth } = useSimpleAuth();

    if (!checkAuth()) {
        return navigateTo('/login');
    }
});
