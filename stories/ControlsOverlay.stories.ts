import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ControlsOverlay from '../app/components/layout/ControlsOverlay.vue';

const backdrop =
    'min-height:520px; padding:24px; background:radial-gradient(circle at 70% 25%, var(--scope-cyan), transparent 55%), radial-gradient(circle at 30% 75%, var(--scope-magenta), transparent 55%), var(--bg)';

const meta: Meta<typeof ControlsOverlay> = {
    title: 'Layouts/ControlsOverlay',
    component: ControlsOverlay,
    parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof ControlsOverlay>;

export const Default: Story = {
    render: () => ({
        components: { ControlsOverlay },
        setup: () => ({ backdrop }),
        template: `<div :style="backdrop"><ControlsOverlay /></div>`,
    }),
};
