import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AdvancedPanel from '../app/components/layout/AdvancedPanel.vue';
import Panel from '../app/components/ds/Panel.vue';

const meta: Meta<typeof AdvancedPanel> = {
    title: 'Layouts/AdvancedPanel',
    component: AdvancedPanel,
    parameters: { layout: 'padded' },
    argTypes: {
        mode: { control: 'inline-radio', options: ['wave', 'per-point', 'per-frame'] },
    },
};

export default meta;
type Story = StoryObj<typeof AdvancedPanel>;

// The disclosure lives at the foot of the Display Settings panel in the app
// (DisplayPanel's #advanced slot), so the stories wrap it in the same Panel
// chrome to show it in context.
export const Collapsed: Story = {
    render: (args) => ({
        components: { AdvancedPanel, Panel },
        setup: () => ({ args }),
        template: `
      <Panel variant="elevated" title="Display Settings" style="max-width: 420px">
        <p style="color: var(--text-muted); margin: 0">(panel body)</p>
        <AdvancedPanel v-bind="args" />
      </Panel>
    `,
    }),
};

export const Open: Story = {
    args: { open: true, mode: 'wave' },
    render: (args) => ({
        components: { AdvancedPanel, Panel },
        setup: () => ({ args }),
        template: `
      <Panel variant="elevated" title="Display Settings" style="max-width: 420px">
        <p style="color: var(--text-muted); margin: 0">(panel body)</p>
        <AdvancedPanel v-bind="args" />
      </Panel>
    `,
    }),
};

// Narrative transform engaged: stage radios + chirality slider live.
export const NarrativeEnabled: Story = {
    args: { open: true, mode: 'per-frame', narrative: true, stage: 'tilt', chirality: 0.22 },
    render: (args) => ({
        components: { AdvancedPanel, Panel },
        setup: () => ({ args }),
        template: `
      <Panel variant="elevated" title="Display Settings" style="max-width: 420px">
        <p style="color: var(--text-muted); margin: 0">(panel body)</p>
        <AdvancedPanel v-bind="args" />
      </Panel>
    `,
    }),
};
