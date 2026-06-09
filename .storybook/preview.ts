import type { Preview } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import ui from '@nuxt/ui/vue-plugin';
import '../app/assets/css/main.css';

// Register Nuxt UI (components + directives) on Storybook's Vue app.
setup((app) => {
    app.use(ui);
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
    // <UApp> provides Nuxt UI's overlay/toast/tooltip context (needed by
    // Toast, Tooltip, etc.).
    decorators: [
        () => ({
            template: '<UApp><story /></UApp>',
        }),
    ],
};

export default preview;
