/* What a knob needs that a bare `f = 200` in the maths tab does not say:
   a range, a taper, a unit and a name for the label strip.

   The maths tab is the source of truth for the *value*; this is the source
   of truth for the *control* around it. Symbols the course uses get a
   sensible range; anything else gets one derived from its current value,
   so an unknown variable still gets a usable knob rather than none. */

import type { KnobTaper } from './knob-geometry';
import type { SketchParam } from './params';

export interface ParamKnob {
    name: string;
    symbol: string;
    label: string;
    unit: string;
    min: number;
    max: number;
    taper: KnobTaper;
    /* Matched to the readout's precision: the knob writes its value into
       the maths source, and 69.99271023161167 has no business being in
       someone's equation. Quantising here keeps the readout, the ARIA
       value and the TeX exactly equal. */
    step: number;
    value: number;
}

interface KnobPreset {
    label: string;
    unit: string;
    min: number;
    max: number;
    taper: KnobTaper;
    step: number;
}

const PRESETS: Record<string, KnobPreset> = {
    /* Amplitude is a linear coefficient in the equation and maps linearly
       to height on the canvas - a log taper here would divorce the knob
       from the maths it is sitting under. */
    A: { label: 'Amp', unit: '', min: 0, max: 1, taper: 'linear', step: 0.001 },
    /* Frequency is the one parameter whose perception is logarithmic.
       Over 20..3000 a linear taper would spend its first octave in under
       1% of the travel; log gives equal rotation to equal interval, and
       makes an arrow key a constant musical step at any pitch. The
       engraved ticks stay evenly spaced - they are a rotation reference,
       and the readout carries the value. */
    f: { label: 'Freq', unit: 'Hz', min: 20, max: 3000, taper: 'log', step: 1 },
    phi: { label: 'Phase', unit: 'rad', min: 0, max: 2 * Math.PI, taper: 'linear', step: 0.01 },
};

/* Parameters that cannot be changed while sound is actually coming out.

   Phase is a direct offset inside the cosine, so moving it mid-note steps
   the waveform rather than bending it the way frequency does - and
   absolute phase is inaudible anyway, so there is nothing to gain for the
   click it costs. Amplitude and frequency stay live: that is the whole
   point of the worklet. The lock lifts the moment playback stops. */
export const LOCKED_WHILE_PLAYING: readonly string[] = ['phi'];

/* KNOB.md section 2: 3dp for a narrow range, integer for a wide one. */
export function defaultFormat(min: number, max: number): (value: number) => string {
    const span = Math.abs(max - min);
    if (span >= 100) return (value) => String(Math.round(value));
    if (span <= 2) return (value) => value.toFixed(3);
    return (value) => value.toFixed(2);
}

export function formatFor(knob: ParamKnob): (value: number) => string {
    if (knob.name === 'A') return (value) => value.toFixed(3);
    if (knob.name === 'f') return (value) => String(Math.round(value));
    if (knob.name === 'phi') return (value) => value.toFixed(2);
    return defaultFormat(knob.min, knob.max);
}

/* A range wide enough that the current value sits inside it with room to
   move, rounded up so the readout ends on something legible. */
function derivedRange(value: number): { min: number; max: number; step: number } {
    const magnitude = Math.abs(value);
    if (magnitude === 0) return { min: 0, max: 1, step: 0.001 };
    const decade = 10 ** Math.ceil(Math.log10(magnitude));
    /* A thousand steps across the range, snapped to a power of ten. */
    const step = 10 ** Math.floor(Math.log10(decade / 1000));
    return value < 0 ? { min: -decade, max: decade, step } : { min: 0, max: decade, step };
}

export function knobFor(param: SketchParam): ParamKnob {
    const preset = PRESETS[param.name];
    const range = preset ?? { label: param.name, unit: '', taper: 'linear' as const, ...derivedRange(param.value) };
    return {
        name: param.name,
        symbol: param.display,
        label: range.label.toUpperCase(),
        unit: range.unit.toUpperCase(),
        min: range.min,
        max: range.max,
        taper: range.taper,
        step: range.step,
        value: param.value,
    };
}

export function knobsFor(params: readonly SketchParam[]): ParamKnob[] {
    return params.map(knobFor);
}
