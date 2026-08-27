import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import SketchKnob from '../../app/components/sketch/SketchKnob.vue';
import SketchDockableCard from '../../app/components/sketch/SketchDockableCard.vue';
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
        dense: true,
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

/* Same box, same rotary, same labels - only the padding gives. Dense is
   the default; the roomier spacing from KNOB.md is opt-in. */
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
        <div style="flex:1; min-width:0"><SketchKnob v-model="a" :min="0" :max="1" symbol="A" label="ROOMY" :dense="false"
          :color="colours.A" :format="(v) => v.toFixed(3)" /></div>
        <div style="flex:1; min-width:0"><SketchKnob v-model="b" :min="0" :max="1" symbol="A" label="DEFAULT"
          :color="colours.A" :format="(v) => v.toFixed(3)" /></div>
      </div>
    `,
    }),
};

/* Pull a card out of the dock by its label strip, drop it back on the
   dock to re-seat it. The rotary keeps its own vertical drag, which is
   the whole reason the grip is the strip and not the card. Floating cards
   are teleported to <body>, so nothing clips them, and they cannot be
   dragged off screen. */
export const Dockable: Story = {
    render: () => ({
        components: { SketchKnob, SketchDockableCard },
        setup() {
            const amp = ref(0.44);
            const freq = ref(693);
            const placements = ref<Record<string, { x: number; y: number } | null>>({ A: null, f: null });
            const zOrder = ref<Record<string, number>>({});
            let nextZ = 50;
            const dock = ref<HTMLElement>();

            /* Same rule the workspace uses: dropped over the dock, it docks. */
            function onDrop(name: string, point: { x: number; y: number }) {
                const r = dock.value?.getBoundingClientRect();
                if (!r) return;
                const inside = point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom;
                if (inside) placements.value[name] = null;
            }
            return { amp, freq, placements, zOrder, dock, onDrop, grab: (n: string) => (zOrder.value[n] = ++nextZ) };
        },
        template: `
      <div style="width:520px">
        <div ref="dock" style="display:flex; gap:16px; padding:14px; border:1px dashed var(--border)">
          <div style="flex:1; min-width:0">
            <SketchDockableCard v-model="placements.A" :z="zOrder.A ?? 50"
              @grab="grab('A')" @drop="onDrop('A', $event)">
              <SketchKnob v-model="amp" :min="0" :max="1" symbol="A" label="AMP" dense
                :color="'var(--sketch-var-3)'" :format="(v) => v.toFixed(3)" />
            </SketchDockableCard>
          </div>
          <div style="flex:1; min-width:0">
            <SketchDockableCard v-model="placements.f" :z="zOrder.f ?? 50"
              @grab="grab('f')" @drop="onDrop('f', $event)">
              <SketchKnob v-model="freq" :min="20" :max="3000" taper="log" symbol="f" label="FREQ" unit="HZ" dense
                :color="'var(--sketch-var-4)'" :format="(v) => String(Math.round(v))" />
            </SketchDockableCard>
          </div>
        </div>
        <p style="margin-top:12px; font-family:var(--font-mono); font-size:10px; color:var(--text-muted)">
          drag a label strip out of the dashed dock, drop it back inside to re-seat
        </p>
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
