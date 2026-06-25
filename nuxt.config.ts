export default defineNuxtConfig({
    ui: {
        theme: {
            // Nuxt UI defaults + tertiary: registering it here compiles
            // color="tertiary" variants (and types) into every component
            colors: ['primary', 'secondary', 'tertiary', 'success', 'info', 'warning', 'error'],
        },
    },

    app: {
        head: {
            title: 'PhaseScope',
            htmlAttrs: {
                lang: 'en',
                class: 'dark',
            },
            meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }],
            link: [{ rel: 'icon', type: 'image/svg+xml', href: '/phasescope-mark.svg' }],
        },
    },
    colorMode: {
        preference: 'dark',
        fallback: 'dark',
    },
    // The visualiser is a client-only WebGL + Web Audio tool (nothing meaningful
    // to server-render), so render it as an SPA. This avoids hydration mismatches
    // from browser-only state (media queries, colour mode, the Three.js engine).
    // The rest of the site keeps SSR.
    routeRules: {
        '/': { redirect: '/phasescope' },
        '/phasescope': { ssr: false },
    },
    devtools: { enabled: true },

    modules: ['@nuxt/eslint', '@nuxt/test-utils', '@nuxt/ui', '@vercel/analytics/nuxt'],
    css: ['~/assets/css/main.css'],
});
