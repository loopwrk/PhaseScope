import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Badge from '../app/components/ds/Badge.vue';

const meta: Meta<typeof Badge> = {
    title: 'Primitives/Badge',
    component: Badge,
    parameters: { layout: 'centered' },
    argTypes: {
        color: { control: 'select', options: ['neutral', 'primary', 'success', 'warning', 'error', 'info'] },
        variant: { control: 'select', options: ['solid', 'outline', 'subtle'] },
        label: { control: 'text' },
        live: { control: 'boolean' },
    },
    args: { color: 'neutral', variant: 'subtle', label: 'Corridor', live: false },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Playground: Story = {};

export const Variants: Story = {
    args: {
        variant: 'solid',
    },

    render: () => ({
        components: { Badge },
        template: `
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <Badge color="neutral" label="Corridor" />
        <Badge color="info" label="Sphere" />
        <Badge color="success" label="Ready" />
        <Badge color="warning" variant="outline" label="3.3M pts" />
        <Badge color="error" variant="outline" label="8M pts" />
        <Badge label="Live" :live="true" variant="outline" />
      </div>
    `,
    }),
};
