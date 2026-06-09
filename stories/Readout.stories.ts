import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Readout from '../app/components/ds/Readout.vue';

const meta: Meta<typeof Readout> = {
    title: 'Primitives/Readout',
    component: Readout,
    parameters: { layout: 'centered' },
    argTypes: {
        value: { control: 'text' },
        unit: { control: 'text' },
        label: { control: 'text' },
        size: { control: 'select', options: ['md', 'lg', 'mega'] },
    },
    args: { label: 'Track coverage', value: '65', unit: '%', size: 'md' },
};

export default meta;
type Story = StoryObj<typeof Readout>;

export const Playground: Story = {};

// Typical HUD readouts at the three sizes.
export const Examples: Story = {
    render: () => ({
        components: { Readout },
        template: `
      <div style="display:flex; gap:48px; align-items:flex-end; flex-wrap:wrap">
        <Readout label="Track coverage" value="65" unit="%" size="md" />
        <Readout label="Points" value="3.34M" size="lg" />
        <Readout label="Elapsed" value="02:41" size="md" />
        <Readout label="Level" value="−6.2" unit="dB" size="mega" />
      </div>
    `,
    }),
};
