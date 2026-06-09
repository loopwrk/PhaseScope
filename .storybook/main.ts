import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.@(ts|js)'],
    framework: {
        name: '@storybook/vue3-vite',
        options: {},
    },
    /* Ensure the Vue SFC plugin is in Storybook's Vite
     pipeline. On some dependency trees the framework's auto-injected plugin
     isn't applied (".vue ... Install @vitejs/plugin-vue" error), so we add
     it ourselves, but only if a 'vite:vue' plugin isn't already present,
     to avoid double transforms. */
    async viteFinal(viteConfig) {
        const plugins = (viteConfig.plugins ?? []) as unknown[];
        const flattened = plugins.flat(Infinity) as Array<{ name?: string }>;
        const hasVue = flattened.some((p) => p && p.name === 'vite:vue');
        if (!hasVue) {
            const vue = (await import('@vitejs/plugin-vue')).default;
            viteConfig.plugins = [...(viteConfig.plugins ?? []), vue()];
        }
        return viteConfig;
    },
};

export default config;
