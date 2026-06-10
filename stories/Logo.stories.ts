import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Logo from '../app/components/ds/Logo.vue';

const meta: Meta<typeof Logo> = {
    title: 'Foundations/Logo',
    component: Logo,
    parameters: { layout: 'centered' },
    argTypes: { size: { control: 'number' } },
    args: { size: 64 },
};

export default meta;
type Story = StoryObj<typeof Logo>;

// Inherits currentColor; accent makes it palette-reactive.
export const Accent: Story = {
    render: (args) => ({
        components: { Logo },
        setup: () => ({ args }),
        template: `<div class="text-(--accent)"><Logo v-bind="args" /></div>`,
    }),
};

export const Sizes: Story = {
    render: () => ({
        components: { Logo },
        template: `
      <div class="flex items-end gap-6 text-(--text)">
        <Logo :size="24" />
        <Logo :size="40" />
        <div class="text-(--accent)"><Logo :size="64" /></div>
      </div>
    `,
    }),
};
