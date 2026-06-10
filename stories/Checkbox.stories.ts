import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import Checkbox from '../app/components/ds/Checkbox.vue';

const meta: Meta<typeof Checkbox> = {
    title: 'Primitives/Checkbox',
    component: Checkbox,
    parameters: { layout: 'centered' },
    argTypes: {
        label: { control: 'text' },
        disabled: { control: 'boolean' },
    },
    args: { label: 'Reverse colour spectrum', disabled: false },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Playground: Story = {
    render: (args) => ({
        components: { Checkbox },
        setup() {
            const v = ref(true);
            return { v, args };
        },
        template: `<Checkbox v-model="v" v-bind="args" />`,
    }),
};

export const States: Story = {
    render: () => ({
        components: { Checkbox },
        setup() {
            const a = ref(false);
            const b = ref(true);
            return { a, b };
        },
        template: `
      <div style="display:flex; flex-direction:column; gap:12px">
        <Checkbox v-model="a" label="Point oscillation" />
        <Checkbox v-model="b" label="Show controls overlay" />
        <Checkbox :model-value="true" :disabled="true" label="Disabled" />
      </div>
    `,
    }),
};
