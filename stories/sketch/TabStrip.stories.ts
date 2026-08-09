import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import TabStrip from '../../app/components/ds/TabStrip.vue';
import { sketchTheme } from '../sketchTheme';

const meta: Meta<typeof TabStrip> = {
    title: 'Primitives/TabStrip',
    component: TabStrip,
    parameters: { layout: 'centered' },
    decorators: [sketchTheme],
    argTypes: {
        size: { control: 'select', options: ['sm', 'md'] },
    },
    args: { size: 'md' },
};

export default meta;
type Story = StoryObj<typeof TabStrip>;

const paneTabs = [
    { value: 'code', label: 'CODE' },
    { value: 'maths', label: 'MATHS' },
    { value: 'notes', label: 'NOTES' },
];

export const PaneTabs: Story = {
    render: (args) => ({
        components: { TabStrip },
        setup() {
            const tab = ref('code');
            return { args, tab, paneTabs };
        },
        template: `
      <div style="width:560px; border:1px solid var(--border-strong); background:var(--surface-elevated)">
        <TabStrip v-model="tab" :tabs="paneTabs" :size="args.size">
          <template #trailing>
            <span style="align-self:center; padding:0 14px; font-family:var(--font-mono); font-size:10px; color:var(--text-muted)">⌥⇧F</span>
          </template>
        </TabStrip>
        <div style="padding:18px; font-family:var(--font-code); font-size:14px; background:var(--surface)">
          pane: {{ tab }}
        </div>
      </div>
    `,
    }),
};
