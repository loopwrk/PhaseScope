import type { Meta, StoryObj } from '@storybook/vue3-vite';
import SketchCard from '../../app/components/sketch/SketchCard.vue';
import { createSketch } from '../../app/utils/sketch/model';
import { sketchTheme } from '../sketchTheme';

const NOW = 1_754_000_000_000;
const sketch = (name: string, language: 'js' | 'tex', agoMs: number) => ({
    ...createSketch({ id: name, now: NOW - agoMs, name, language }),
});

const meta: Meta<typeof SketchCard> = {
    title: 'Library/SketchCard',
    component: SketchCard,
    parameters: { layout: 'padded' },
    decorators: [sketchTheme],
};

export default meta;
type Story = StoryObj<typeof SketchCard>;

// The library grid context: three cards, mixed languages and ages.
export const LibraryRow: Story = {
    render: () => ({
        components: { SketchCard },
        setup: () => ({
            now: NOW,
            sketches: [
                sketch('dft-basis-sweep', 'js', 2 * 60_000),
                sketch('fourier-theorems', 'tex', 4 * 86_400_000),
                sketch('harmonic-model', 'js', 7 * 86_400_000),
            ],
        }),
        template: `
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; max-width:720px">
        <SketchCard v-for="s in sketches" :key="s.id" :sketch="s" :now="now" />
      </div>
    `,
    }),
};

export const Single: Story = {
    args: { sketch: sketch('window-shapes', 'js', 60_000), now: NOW },
};
