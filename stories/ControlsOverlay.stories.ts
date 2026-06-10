import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ControlsOverlay from '../app/components/layout/ControlsOverlay.vue';

const backdrop =
    'min-height:640px; padding:24px; background:radial-gradient(circle at 70% 25%, var(--scope-cyan), transparent 55%), radial-gradient(circle at 30% 75%, var(--scope-magenta), transparent 55%), var(--bg)';

const meta: Meta<typeof ControlsOverlay> = {
    title: 'Layouts/ControlsOverlay',
    component: ControlsOverlay,
    parameters: { layout: 'fullscreen' },
    argTypes: {
        cameraMode: { control: 'inline-radio', options: ['free', 'follow', 'orbit'] },
        speedIndex: { control: 'inline-radio', options: [0, 1, 2] },
        moving: { control: 'boolean' },
        disabled: { control: 'boolean' },
    },
    args: { cameraMode: 'orbit', speedIndex: 1, moving: false, disabled: false },
};

export default meta;
type Story = StoryObj<typeof ControlsOverlay>;

export const Default: Story = {
    render: (args) => ({
        components: { ControlsOverlay },
        setup: () => ({ args, backdrop }),
        template: `<div :style="backdrop"><ControlsOverlay v-bind="args" /></div>`,
    }),
};

// WASD pad lit + free-fly camera, as it looks mid-flight.
export const Moving: Story = {
    args: { cameraMode: 'free', speedIndex: 2, moving: true },
    render: (args) => ({
        components: { ControlsOverlay },
        setup: () => ({ args, backdrop }),
        template: `<div :style="backdrop"><ControlsOverlay v-bind="args" /></div>`,
    }),
};
