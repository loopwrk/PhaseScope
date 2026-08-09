import type { Meta, StoryObj } from '@storybook/vue3-vite';
import StatusDot from '../../app/components/ds/StatusDot.vue';
import { sketchTheme } from '../sketchTheme';

const meta: Meta<typeof StatusDot> = {
    title: 'Primitives/StatusDot',
    component: StatusDot,
    parameters: { layout: 'centered' },
    decorators: [sketchTheme],
    argTypes: {
        state: { control: 'select', options: ['ok', 'error', 'neutral'] },
        label: { control: 'text' },
    },
    args: { state: 'ok', label: 'ran cleanly' },
};

export default meta;
type Story = StoryObj<typeof StatusDot>;

export const Playground: Story = {};

export const States: Story = {
    render: () => ({
        components: { StatusDot },
        template: `
      <div style="display:flex; gap:24px; align-items:center; font-family:var(--font-code); font-size:13px">
        <span style="display:flex; gap:8px; align-items:center">
          <StatusDot state="ok" label="ran cleanly" /> ran in 12ms · 1024 samples
        </span>
        <span style="display:flex; gap:8px; align-items:center">
          <StatusDot state="error" label="run failed" /> ReferenceError: ctx is not defined
        </span>
        <span style="display:flex; gap:8px; align-items:center">
          <StatusDot state="neutral" label="not run yet" /> not run yet
        </span>
      </div>
    `,
    }),
};
