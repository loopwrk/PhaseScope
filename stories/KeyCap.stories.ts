import type { Meta, StoryObj } from '@storybook/vue3-vite';
import KeyCap from '../app/components/ds/KeyCap.vue';

const meta: Meta<typeof KeyCap> = {
    title: 'Primitives/KeyCap',
    component: KeyCap,
    parameters: { layout: 'centered' },
    argTypes: {
        label: { control: 'text' },
        accent: { control: 'boolean' },
    },
    args: { label: 'R', accent: false },
};

export default meta;
type Story = StoryObj<typeof KeyCap>;

export const Playground: Story = {};

// A controls-overlay row: the active shortcut uses `accent`.
export const Shortcuts: Story = {
    render: () => ({
        components: { KeyCap },
        template: `
      <div style="display:flex; gap:8px; align-items:center">
        <KeyCap label="R" :accent="true" />
        <KeyCap label="O" />
        <KeyCap label="C" />
        <KeyCap label="V" />
        <KeyCap label="H" />
        <KeyCap label="ENTER ↵" />
        <KeyCap label="{" />
        <KeyCap label="}" />
      </div>
    `,
    }),
};
