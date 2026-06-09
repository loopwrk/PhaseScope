import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.@(ts|js)'],
    framework: {
        name: '@storybook/vue3-vite',
        options: {},
    },
    async viteFinal(viteConfig) {
        const ui = (await import('@nuxt/ui/vite')).default;
        viteConfig.plugins = [...(viteConfig.plugins ?? []), ui()];
        return viteConfig;
    },
};

export default config;
