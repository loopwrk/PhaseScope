import type { Meta, StoryObj } from '@storybook/vue3-vite';
import TransportBar from '../app/components/layout/TransportBar.vue';

const backdrop =
    'min-height:200px; display:flex; align-items:flex-end; padding:16px; background:radial-gradient(circle at 30% 30%, var(--scope-amber), transparent 55%), radial-gradient(circle at 75% 70%, var(--scope-magenta), transparent 55%), var(--bg)';

const meta: Meta<typeof TransportBar> = {
    title: 'Layouts/TransportBar',
    component: TransportBar,
    parameters: { layout: 'fullscreen' },
    argTypes: {
        playing: { control: 'boolean' },
        track: { control: 'text' },
        elapsed: { control: 'text' },
    },
    args: { playing: true, track: 'a-03-esperaphora', elapsed: '02:41' },
    render: (args) => ({
        components: { TransportBar },
        setup: () => ({ args, backdrop }),
        template: `<div :style="backdrop"><TransportBar v-bind="args" style="width:100%" /></div>`,
    }),
};

export default meta;
type Story = StoryObj<typeof TransportBar>;

export const Playing: Story = {};
export const Paused: Story = { args: { playing: false, elapsed: '00:00' } };
