import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Welcome from './WelcomeIntro.vue';

const meta: Meta<typeof Welcome> = {
    title: 'Welcome',
    component: Welcome,
    parameters: {
        layout: 'fullscreen',
    },
};

export default meta;
type Story = StoryObj<typeof Welcome>;

export const Default: Story = {};
