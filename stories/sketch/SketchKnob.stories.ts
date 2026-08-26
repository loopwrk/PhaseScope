import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import SketchKnob from '../../app/components/sketch/SketchKnob.vue';
import { sketchTheme } from '../sketchTheme';

const meta: Meta<typeof SketchKnob> = {
    title: 'Primitives/Knob',
    component: SketchKnob,
    parameters: { layout: 'centered' },
    decorators: [sketchTheme],
    argTypes: {
        taper: { control: 'select', options: ['linear', 'log'] },
        sweep: { control: { type: 'range', min: 180, max: 340, step: 10 } },
        disabled: { control: 'boolean' },
        dense: { control: 'boolean' },
    },
    args: {
        min: 0,
        max: 1,
        symbol: 'A',
        label: 'AMP',
        unit: '',
        taper: 'linear',
        sweep: 270,
        disabled: false,
        dense: false,
    },
};

export default meta;
type Story = StoryObj<typeof SketchKnob>;

const ROW = `
  <div style="display:flex; gap:16px; width:660px">
    <div style="flex:1; min-width:0"><SketchKnob v-model="amp" :min="0" :max="1" symbol="A" label="AMP"
      :color="colours.A" :format="(v) => v.toFixed(3)" /></div>
    <div style="flex:1; min-width:0"><SketchKnob v-model="freq" :min="20" :max="3000" taper="log" symbol="f" label="FREQ"
      unit="HZ" :color="colours.f" :format="(v) => String(Math.round(v))" /></div>
    <div style="flex:1; min-width:0"><SketchKnob v-model="phase" :min="0" :max="2 * Math.PI" symbol="φ" label="PHASE"
      unit="RAD" :color="colours.phi" :format="(v) => v.toFixed(2)" /></div>
  </div>
`;

/* The A / f / φ row from the mock, each tinted with its equation colour. */
export const EquationRow: Story = {
    render: () => ({
        components: { SketchKnob },
        setup() {
            return {
                amp: ref(0.44),
                freq: ref(693),
                phase: ref(3.46),
                /* the colours the equation gives these three symbols */
                colours: { A: 'var(--sketch-var-3)', f: 'var(--sketch-var-4)', phi: 'var(--sketch-var-6)' },
            };
        },
        template: ROW,
    }),
};

/* Enabled above, disabled below, same colours either way: the state is
   carried by the dim, not by a change of hue. A disabled knob refuses the
   drag, the wheel, the arrow keys, the double-click reset and the typed
   readout, sits outside the tab order, and reports aria-disabled. */
export const Disabled: Story = {
    render: () => ({
        components: { SketchKnob },
        setup() {
            return {
                a: ref(0.44),
                f: ref(693),
                p: ref(3.46),
                da: ref(0.44),
                df: ref(693),
                dp: ref(3.46),
                colours: { A: 'var(--sketch-var-3)', f: 'var(--sketch-var-4)', phi: 'var(--sketch-var-6)' },
            };
        },
        template: `
      <div style="display:flex; flex-direction:column; gap:20px; width:660px">
        <div style="display:flex; gap:16px">
          <div style="flex:1; min-width:0"><SketchKnob v-model="a" :min="0" :max="1" symbol="A" label="AMP"
            :color="colours.A" :format="(v) => v.toFixed(3)" /></div>
          <div style="flex:1; min-width:0"><SketchKnob v-model="f" :min="20" :max="3000" taper="log" symbol="f"
            label="FREQ" unit="HZ" :color="colours.f" :format="(v) => String(Math.round(v))" /></div>
          <div style="flex:1; min-width:0"><SketchKnob v-model="p" :min="0" :max="2 * Math.PI" symbol="φ"
            label="PHASE" unit="RAD" :color="colours.phi" :format="(v) => v.toFixed(2)" /></div>
        </div>
        <div style="display:flex; gap:16px">
          <div style="flex:1; min-width:0"><SketchKnob v-model="da" disabled :min="0" :max="1" symbol="A" label="AMP"
            :color="colours.A" :format="(v) => v.toFixed(3)" /></div>
          <div style="flex:1; min-width:0"><SketchKnob v-model="df" disabled :min="20" :max="3000" taper="log" symbol="f"
            label="FREQ" unit="HZ" :color="colours.f" :format="(v) => String(Math.round(v))" /></div>
          <div style="flex:1; min-width:0"><SketchKnob v-model="dp" disabled :min="0" :max="2 * Math.PI" symbol="φ"
            label="PHASE" unit="RAD" :color="colours.phi" :format="(v) => v.toFixed(2)" /></div>
        </div>
      </div>
    `,
    }),
};

/* Both tapers over the same 20..3000 range. Drag them together: the log
   knob gives equal rotation to equal musical interval, so its lower half
   is usable; the linear one spends its first octave in under 1% of the
   travel. The engraved ticks are the same on both - they mark rotation,
   not value, and the readout carries the number. */
export const Taper: Story = {
    render: () => ({
        components: { SketchKnob },
        setup() {
            return { linear: ref(693), log: ref(693) };
        },
        template: `
      <div style="display:flex; gap:16px; width:440px">
        <div style="flex:1; min-width:0"><SketchKnob v-model="linear" :min="20" :max="3000" taper="linear"
          symbol="f" label="LINEAR" unit="HZ" :format="(v) => String(Math.round(v))" /></div>
        <div style="flex:1; min-width:0"><SketchKnob v-model="log" :min="20" :max="3000" taper="log"
          symbol="f" label="LOG" unit="HZ" :color="'var(--sketch-var-4)'" :format="(v) => String(Math.round(v))" /></div>
      </div>
    `,
    }),
};

/* Sweep changes the arc and the travel together; 270 puts the centre tick
   at twelve o'clock, 330 wraps further round the cap. */
export const Sweep: Story = {
    render: () => ({
        components: { SketchKnob },
        setup() {
            return { a: ref(0.5), b: ref(0.5) };
        },
        template: `
      <div style="display:flex; gap:16px; width:440px">
        <div style="flex:1; min-width:0"><SketchKnob v-model="a" :min="0" :max="1" :sweep="270"
          symbol="A" label="SWEEP 270" :format="(v) => v.toFixed(3)" /></div>
        <div style="flex:1; min-width:0"><SketchKnob v-model="b" :min="0" :max="1" :sweep="330"
          symbol="A" label="SWEEP 330" :color="'var(--sketch-var-7)'" :format="(v) => v.toFixed(3)" /></div>
      </div>
    `,
    }),
};

/* Same box, same rotary, same labels - only the padding gives. This is
   what the workspace column uses, where every pixel is spoken for. */
export const Dense: Story = {
    render: () => ({
        components: { SketchKnob },
        setup() {
            return {
                a: ref(0.44),
                b: ref(0.44),
                colours: { A: 'var(--sketch-var-3)' },
            };
        },
        template: `
      <div style="display:flex; gap:16px; align-items:flex-start; width:440px">
        <div style="flex:1; min-width:0"><SketchKnob v-model="a" :min="0" :max="1" symbol="A" label="DEFAULT"
          :color="colours.A" :format="(v) => v.toFixed(3)" /></div>
        <div style="flex:1; min-width:0"><SketchKnob v-model="b" :min="0" :max="1" symbol="A" label="DENSE" dense
          :color="colours.A" :format="(v) => v.toFixed(3)" /></div>
      </div>
    `,
    }),
};

/* Single knob wired to the controls panel. */
export const Playground: Story = {
    render: (args) => ({
        components: { SketchKnob },
        setup() {
            const value = ref(0.44);
            return { args, value };
        },
        template: `<div style="width:210px"><SketchKnob v-bind="args" v-model="value" /></div>`,
    }),
};
