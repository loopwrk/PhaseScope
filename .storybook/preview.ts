import type { Preview } from '@storybook/vue3-vite';

/* Load the design-system token layer directly (NOT main.css, which pulls in
   Tailwind + Nuxt UI and isn't needed to render the foundations). */
import '../app/assets/css/tokens/fonts.css';
import '../app/assets/css/tokens/palettes.css';
import '../app/assets/css/tokens.css';
import '../app/assets/css/tokens/effects.css';
import '../app/assets/css/tokens/utilities.css';

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
};

export default preview;
