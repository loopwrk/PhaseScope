import type { Meta, StoryObj } from '@storybook/vue3-vite';
import TransportBar from '../app/components/layout/TransportBar.vue';

const backdrop =
    'min-height:200px; display:flex; align-items:flex-end; padding:16px; background:radial-gradient(circle at 30% 30%, var(--scope-amber), transparent 55%), radial-gradient(circle at 75% 70%, var(--scope-magenta), transparent 55%), var(--bg)';

const tracks = [
    { label: 'a-01-lusocereus', value: 'auto-a-01' },
    { label: 'a-03-esperaphora', value: 'auto-a-03' },
    { label: 'a-06-atchurple', value: 'auto-a-06' },
];

const meta: Meta<typeof TransportBar> = {
    title: 'Layouts/TransportBar',
    component: TransportBar,
    parameters: { layout: 'fullscreen' },
    argTypes: {
        playing: { control: 'boolean' },
        audioLoaded: { control: 'boolean' },
        started: { control: 'boolean' },
        track: { control: 'text' },
        elapsed: { control: 'text' },
    },
    args: {
        playing: true,
        audioLoaded: true,
        started: true,
        track: 'a-03-esperaphora',
        elapsed: '02:41',
        tracks,
        selectedTrack: 'auto-a-03',
    },
    render: (args) => ({
        components: { TransportBar },
        setup: () => ({ args, backdrop }),
        template: `<div :style="backdrop"><TransportBar v-bind="args" style="width:100%" /></div>`,
    }),
};

export default meta;
type Story = StoryObj<typeof TransportBar>;

export const Playing: Story = {};
export const Paused: Story = { args: { playing: false, started: false, elapsed: '00:00' } };
