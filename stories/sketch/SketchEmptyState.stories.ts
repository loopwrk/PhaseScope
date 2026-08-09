import type { Meta, StoryObj } from '@storybook/vue3-vite';
import SketchEmptyState from '../../app/components/sketch/SketchEmptyState.vue';
import { sketchTheme } from '../sketchTheme';

const meta: Meta<typeof SketchEmptyState> = {
    title: 'Library/SketchEmptyState',
    component: SketchEmptyState,
    parameters: { layout: 'centered' },
    decorators: [sketchTheme],
};

export default meta;
type Story = StoryObj<typeof SketchEmptyState>;

export const Default: Story = {};

// Border thickens while an audio file is dragged over the viewport.
export const DragActive: Story = {
    args: { dragActive: true },
};
