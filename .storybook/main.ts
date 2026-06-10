import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.@(ts|js)'],
    framework: {
        name: '@storybook/vue3-vite',
        options: {},
    },
    async viteFinal(viteConfig) {
        const plugins = (viteConfig.plugins ?? []) as unknown[];
        const flattened = plugins.flat(Infinity) as Array<{ name?: string }>;
        const extra: unknown[] = [];

        // Load-bearing: @storybook/vue3-vite does NOT reliably register
        // @vitejs/plugin-vue in this setup, so .vue files fail to parse
        // ("Install @vitejs/plugin-vue ..."). Add it ourselves if absent.
        // Guarded so we never double-register (which would double-transform).
        if (!flattened.some((p) => p && p.name === 'vite:vue')) {
            const vue = (await import('@vitejs/plugin-vue')).default;
            extra.push(vue());
        }

        const ui = (await import('@nuxt/ui/vite')).default;
        extra.push(ui());

        viteConfig.plugins = [...(viteConfig.plugins ?? []), ...extra];
        return viteConfig;
    },
};

export default config;
