import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import SegmentedControl from '../../app/components/ds/SegmentedControl.vue';
import { sketchTheme } from '../sketchTheme';

const meta: Meta<typeof SegmentedControl> = {
    title: 'Primitives/SegmentedControl',
    component: SegmentedControl,
    parameters: { layout: 'centered' },
    decorators: [sketchTheme],
    argTypes: {
        size: { control: 'select', options: ['sm', 'md'] },
    },
    args: { size: 'md' },
};

export default meta;
type Story = StoryObj<typeof SegmentedControl>;

export const AspectControl: Story = {
    render: (args) => ({
        components: { SegmentedControl },
        setup() {
            const aspect = ref('fit');
            return { args, aspect };
        },
        template: `
      <div style="display:flex; flex-direction:column; gap:16px; align-items:flex-start">
        <SegmentedControl
          v-model="aspect"
          :size="args.size"
          :options="[
            { value: 'fit', label: 'FIT' },
            { value: '16:9', label: '16:9' },
            { value: '1:1', label: '1:1' },
            { value: 'free', label: 'FREE' },
          ]"
        />
        <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted)">selected: {{ aspect }}</span>
      </div>
    `,
    }),
};
