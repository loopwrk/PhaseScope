import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Panel from '../app/components/ds/Panel.vue';

const meta: Meta<typeof Panel> = {
    title: 'Primitives/Panel',
    component: Panel,
    parameters: { layout: 'padded' },
    argTypes: {
        variant: { control: 'select', options: ['solid', 'glass', 'elevated'] },
    },
    args: { variant: 'solid' },
    render: (args) => ({
        components: { Panel },
        setup: () => ({ args }),
        template: `
      <Panel v-bind="args" style="max-width: 320px">
        <p style="font-family: var(--font-display); font-size: var(--font-size-heading); margin: 0 0 var(--space-2)">Display Settings</p>
        <p style="color: var(--text-muted); margin: 0; line-height: var(--line-height-normal)">
          Audio traces a Lorenz attractor; amplitude drives the chaos parameter.
        </p>
      </Panel>
    `,
    }),
};

export default meta;
type Story = StoryObj<typeof Panel>;

export const Playground: Story = {};

// All three variants. Glass is shown over a vivid backdrop (standing in for
// the live visualiser canvas) so the backdrop blur is visible.
export const Variants: Story = {
    render: () => ({
        components: { Panel },
        template: `
      <div style="display:flex; gap:24px; flex-wrap:wrap; align-items:flex-start">
        <Panel variant="solid" style="width:220px">
          <span style="font-family:var(--font-mono); font-size:var(--font-size-caption); letter-spacing:var(--label-tracking-wide); text-transform:uppercase; color:var(--text-muted)">Solid</span>
        </Panel>
        <Panel variant="elevated" style="width:220px">
          <span style="font-family:var(--font-mono); font-size:var(--font-size-caption); letter-spacing:var(--label-tracking-wide); text-transform:uppercase; color:var(--text-muted)">Elevated</span>
        </Panel>
        <div style="padding:24px; background:radial-gradient(circle at 30% 30%, var(--scope-magenta), transparent 60%), radial-gradient(circle at 70% 70%, var(--scope-cyan), transparent 60%), var(--bg)">
          <Panel variant="glass" style="width:220px">
            <span style="font-family:var(--font-mono); font-size:var(--font-size-caption); letter-spacing:var(--label-tracking-wide); text-transform:uppercase; color:var(--text)">Glass over canvas</span>
          </Panel>
        </div>
      </div>
    `,
    }),
};
