import type { Meta, StoryObj } from '@storybook/vue3-vite';
import DisplayPanel from '../app/components/layout/DisplayPanel.vue';

const meta: Meta<typeof DisplayPanel> = {
    title: 'Layouts/DisplayPanel',
    component: DisplayPanel,
    parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof DisplayPanel>;

export const Default: Story = {};
