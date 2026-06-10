import type { Preview } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import ui from '@nuxt/ui/vue-plugin';
import UApp from '@nuxt/ui/components/App.vue';
import { createRouter, createMemoryHistory } from 'vue-router';

/* Full app stylesheet: Tailwind + Nuxt UI + our token bridge (main.css
   pulls in fonts/palettes/tokens/effects/utilities via its @imports). */
import '../app/assets/css/main.css';

// A minimal in-memory router. Nuxt UI's internal Link injects vue-router's
// route location; without a router Storybook warns "injection Symbol(route
// location) not found". This stub provides it (no real navigation).
const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:catchAll(.*)*', component: { render: () => null } }],
});

setup((app) => {
    app.use(router);
    app.use(ui);
    // The standalone vue-plugin doesn't always give App the U-prefixed global
    // registration, so register it explicitly. UApp hosts the toast/overlay
    // portal that useToast renders into.
    app.component('UApp', UApp);
});

// Default every story to the dark "spaceship dashboard" aesthetic.
if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
}

const preview: Preview = {
    parameters: {
        backgrounds: { disable: true },
        controls: {
            matchers: { color: /(background|color)$/i, date: /Date$/i },
        },
    },
    // <UApp> provides Nuxt UI's overlay/toast/tooltip context.
    decorators: [
        () => ({
            template: '<UApp><story /></UApp>',
        }),
    ],
};

export default preview;
