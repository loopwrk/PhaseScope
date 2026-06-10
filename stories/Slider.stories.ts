import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import Slider from '../app/components/ds/Slider.vue';

const meta: Meta<typeof Slider> = {
    title: 'Primitives/Slider',
    component: Slider,
    parameters: { layout: 'padded' },
    argTypes: {
        min: { control: 'number' },
        max: { control: 'number' },
        step: { control: 'number' },
        disabled: { control: 'boolean' },
    },
    args: { min: 0, max: 100, step: 1, disabled: false },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Playground: Story = {
    render: (args) => ({
        components: { Slider },
        setup() {
            const v = ref(65);
            return { v, args };
        },
        template: `<div style="width:280px"><Slider v-model="v" v-bind="args" /></div>`,
    }),
};

// Slider + Readout composition, as used in the Display Settings panel.
export const WithReadout: Story = {
    render: () => ({
        components: { Slider },
        setup() {
            const v = ref(65);
            return { v };
        },
        template: `
      <div style="width:280px; display:flex; flex-direction:column; gap:12px">
        <div style="font-family:var(--font-mono); font-size:var(--font-size-caption); letter-spacing:var(--label-tracking-wide); text-transform:uppercase; color:var(--text-muted); display:flex; justify-content:space-between">
          <span>Track coverage</span><span style="color:var(--text)">{{ v }}%</span>
        </div>
        <Slider v-model="v" />
      </div>
    `,
    }),
};
