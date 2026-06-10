import type { Meta, StoryObj } from '@storybook/vue3-vite';
import IconButton from '../app/components/ds/IconButton.vue';

const meta: Meta<typeof IconButton> = {
    title: 'Primitives/IconButton',
    component: IconButton,
    parameters: { layout: 'centered' },
    argTypes: {
        icon: { control: 'text' },
        variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
        size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
        disabled: { control: 'boolean' },
        ariaLabel: { control: 'text' },
    },
    args: { icon: 'i-lucide-play', variant: 'ghost', size: 'md', disabled: false, ariaLabel: 'Play' },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Playground: Story = {};

export const Variants: Story = {
    render: () => ({
        components: { IconButton },
        template: `
      <div style="display:flex; gap:16px; align-items:center">
        <IconButton icon="i-lucide-play" variant="primary" aria-label="Play" />
        <IconButton icon="i-lucide-pause" variant="secondary" aria-label="Pause" />
        <IconButton icon="i-lucide-maximize" variant="ghost" aria-label="Fullscreen" />
        <IconButton icon="i-lucide-rotate-ccw" variant="danger" aria-label="Reset" />
        <IconButton icon="i-lucide-settings" variant="ghost" :disabled="true" aria-label="Settings" />
      </div>
    `,
    }),
};
