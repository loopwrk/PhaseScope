import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import Switch from '../app/components/ds/Switch.vue';

const meta: Meta<typeof Switch> = {
    title: 'Primitives/Switch',
    component: Switch,
    parameters: { layout: 'centered' },
    argTypes: {
        disabled: { control: 'boolean' },
        size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    },
    args: { disabled: false, size: 'md' },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Playground: Story = {
    render: (args) => ({
        components: { Switch },
        setup() {
            const on = ref(true);
            return { on, args };
        },
        template: `<Switch v-model="on" v-bind="args" />`,
    }),
};

export const States: Story = {
    render: () => ({
        components: { Switch },
        setup() {
            const a = ref(false);
            const b = ref(true);
            return { a, b };
        },
        template: `
      <div style="display:flex; gap:24px; align-items:center">
        <Switch v-model="a" />
        <Switch v-model="b" />
        <Switch :model-value="true" :disabled="true" />
      </div>
    `,
    }),
};
