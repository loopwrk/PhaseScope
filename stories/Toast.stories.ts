import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ToastDemo from './ToastDemo.vue';

/* Toasts are triggered via usePsToast() and rendered by <UApp>'s toaster
   (top-right of the preview), so this story is a set of trigger buttons
   rather than a placed component. */
const meta: Meta<typeof ToastDemo> = {
    title: 'Primitives/Toast',
    component: ToastDemo,
    parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ToastDemo>;

export const Triggers: Story = {};
