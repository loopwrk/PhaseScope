import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import RadioGroup from '../app/components/ds/RadioGroup.vue';

const topology = [
    { label: 'Corridor', value: 'corridor' },
    { label: 'Sphere', value: 'sphere' },
    { label: 'Attractor', value: 'attractor' },
];

const meta: Meta<typeof RadioGroup> = {
    title: 'Primitives/RadioGroup',
    component: RadioGroup,
    parameters: { layout: 'padded' },
    argTypes: {
        orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
        disabled: { control: 'boolean' },
    },
    args: { orientation: 'vertical', disabled: false },
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Playground: Story = {
    render: (args) => ({
        components: { RadioGroup },
        setup() {
            const v = ref('corridor');
            return { v, args, topology };
        },
        template: `<RadioGroup v-model="v" :items="topology" v-bind="args" />`,
    }),
};

export const Horizontal: Story = {
    render: () => ({
        components: { RadioGroup },
        setup() {
            const v = ref('sphere');
            return { v, topology };
        },
        template: `<RadioGroup v-model="v" :items="topology" orientation="horizontal" />`,
    }),
};
