import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ColorSystem from './ColorSystem.vue';

const meta: Meta<typeof ColorSystem> = {
    title: 'Foundations/Colours',
    component: ColorSystem,
    parameters: {
        layout: 'fullscreen',
    },
    argTypes: {
        palette: {
            name: 'Palette',
            description: 'Brand palette (swatch architecture: [data-palette])',
            control: 'select',
            options: ['azure', 'magenta', 'violet', 'rhuby', 'morpheus', 'blink'],
        },
    },
    args: {
        palette: 'azure',
    },
};

export default meta;
type Story = StoryObj<typeof ColorSystem>;

export const Overview: Story = {};
