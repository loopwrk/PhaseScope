import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AppHeader from '../app/components/layout/AppHeader.vue';

const backdrop =
    'min-height:220px; padding:16px; background:radial-gradient(circle at 25% 20%, var(--scope-magenta), transparent 55%), radial-gradient(circle at 80% 60%, var(--scope-cyan), transparent 55%), var(--bg)';

const meta: Meta<typeof AppHeader> = {
    title: 'Layouts/AppHeader',
    component: AppHeader,
    parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof AppHeader>;

export const Default: Story = {
    render: () => ({
        components: { AppHeader },
        setup: () => ({ backdrop }),
        template: `<div :style="backdrop"><AppHeader /></div>`,
    }),
};
