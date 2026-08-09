import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Button from '../../app/components/ds/Button.vue';
import { sketchTheme } from '../sketchTheme';

const meta: Meta<typeof Button> = {
    title: 'Primitives/Button',
    component: Button,
    parameters: { layout: 'centered' },
    argTypes: {
        variant: {
            name: 'Variant',
            control: 'select',
            options: ['primary', 'secondary', 'ghost', 'danger', 'sketch-primary', 'sketch-surface', 'sketch-panel'],
        },
        size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
        disabled: { control: 'boolean' },
        label: { control: 'text' },
    },
    args: { variant: 'primary', size: 'md', disabled: false, label: 'Load Audio' },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Playground: Story = {};

export const Variants: Story = {
    render: () => ({
        components: { Button },
        template: `
      <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center">
        <Button variant="primary" label="Primary" />
        <Button variant="secondary" label="Secondary" />
        <Button variant="ghost" label="Ghost" />
        <Button variant="danger" label="Danger" />
        <Button variant="primary" label="Disabled" :disabled="true" />
      </div>
    `,
    }),
};

export const SketchVariants: Story = {
    decorators: [sketchTheme],
    render: () => ({
        components: { Button },
        template: `
      <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center">
        <Button variant="sketch-primary" label="Run ⏎" />
        <Button variant="sketch-surface" label="Sketches ▾" />
        <Button variant="sketch-panel" size="sm" label="◉ PNG" />
        <Button variant="sketch-primary" size="lg" label="New Sketch ⌘N" />
        <Button variant="sketch-surface" label="Disabled" :disabled="true" />
      </div>
    `,
    }),
};
