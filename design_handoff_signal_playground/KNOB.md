# Component spec: `BenchKnob` (approved option **2d — Panel**)

Companion to `README.md`. Same design language, same tokens. This file is a complete
implementation spec for one component: a DAW-style rotary knob that drives a live variable
in the equation shown above the render.

The visual reference is `Signal Playground.dc.html`, **turn 2, the mockup badged `2d`**
(top of the canvas). Options 2a / 2b / 2c are rejected alternatives — ignore them.
The knobs in the mock are live: drag vertically, hold shift for fine adjust.

---

## 1. What it is

One knob = one front-panel module: a bordered card with a screened label strip, a rotary
control with an engraved scale, MIN/MAX screening, and a numeric readout footer. Knobs sit
in a row beneath the rendered equation, one per exposed variable, each tinted with that
variable's colour from the equation.

```
┌──────────────────────────┐
│ A   AMP              ■   │  label strip   (border-bottom hairline)
├──────────────────────────┤
│                          │
│        ╭────────╮        │  rotary       (engraved ticks + value arc
│       │  ▌ cap  │        │                + ink cap + yellow indicator)
│        ╰────────╯        │
│                          │
│  MIN                MAX  │  screening
├──────────────────────────┤
│        0.723             │  readout      (border-top ink)
└──────────────────────────┘
```

## 2. Public API

```ts
interface BenchKnobProps {
  modelValue: number        // the real value, in the variable's own units
  min: number
  max: number
  step?: number             // quantisation of modelValue; default 0 (continuous)
  symbol: string            // 'A' | 'f' | 'φ' — rendered serif italic
  label: string             // 'AMP' | 'FREQ' | 'PHASE' — screened, uppercase
  unit?: string             // 'HZ' | 'RAD' | '' — uppercase mono, after the value
  color?: string            // the variable's equation colour; default token `--accent`
  format?: (v: number) => string   // readout formatting; default below
  sweep?: number            // total rotation in degrees; default 270
  taper?: 'linear' | 'log'  // default 'linear'; 'log' for frequency
  disabled?: boolean
}
// emits: 'update:modelValue' (number)
```

Default `format`: 3 significant decimals for |max−min| ≤ 2, integer for ≥ 100, else 2dp.
The three variables in the mock use `A → v.toFixed(3)`, `f → Math.round(v)`,
`φ → v.toFixed(2)`.

**Normalised position** `t ∈ [0,1]` is the internal representation; `modelValue` is derived.
- linear: `t = (v − min) / (max − min)`
- log: `t = Math.log(v / min) / Math.log(max / min)` (requires `min > 0`)

## 3. Geometry — draw it as one inline SVG, `viewBox="0 0 100 100"`

All numbers below are in that 100×100 user space; the SVG renders at **98 × 98 CSS px**.
Centre `c = (50, 50)`. Radius of the value arc `R = 42`.

Polar helper (0° points up, positive clockwise):

```ts
const pol = (deg: number, r: number) => [
  50 + r * Math.sin(deg * Math.PI / 180),
  50 - r * Math.cos(deg * Math.PI / 180)
]
```

Let `half = sweep / 2` (135° at the default sweep), so the control travels from `−half`
(min, lower-left) to `+half` (max, lower-right).

### 3.1 Track / value arc path

```ts
const [sx, sy] = pol(-half, R)
const [ex, ey] = pol( half, R)
const d = `M${sx} ${sy} A ${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${ex} ${ey}`
const total = 2 * Math.PI * R * (sweep / 360)     // 197.92 at 270°
const dash  = `${total * t} ${total - total * t + 2}`
```

Two stacked `<path>` elements, both using `d`:
1. track — `stroke #D5CFC2`, `stroke-width 3.5`, `fill none`
2. value — `stroke {color}`, `stroke-width 3.5`, `fill none`, `stroke-dasharray {dash}`

No round caps — butt ends, consistent with the flat-edged language.

### 3.2 Engraved ticks — 11 marks, static

```ts
for (let i = 0; i <= 10; i++) {
  const a = -half + (sweep * i) / 10
  const long = i === 0 || i === 5 || i === 10
  const [x1, y1] = pol(a, long ? 32 : 35)
  const [x2, y2] = pol(a, 40)
  // <line> stroke="#B3ADA0" stroke-width={long ? 1.6 : 1}
}
```

Ticks render **under** the arc paths.

### 3.3 Cap and indicator

- cap: `<circle cx=50 cy=50 r=27 fill="#1A1917">` — solid ink, no stroke, no gradient.
- inner ring: `<circle cx=50 cy=50 r=21 fill="none" stroke="#3A3833" stroke-width="1">`
  (a single lighter ring reads as a machined lip; do not add more).
- indicator: `<line x1=50 y1=45 x2=50 y2=28 stroke="#F2C230" stroke-width="3"
  stroke-linecap="square">` wrapped in `<g transform="rotate({angle} 50 50)">`,
  where `angle = -half + t * sweep`.
- while dragging, the indicator goes `#FFD34D`; nothing else changes.

That is the entire rotary. No drop shadow, no bevel, no radial gradient, no knurling.

## 4. Card chrome

Card: `background #F6F3EC`, `border 1px solid #1A1917`, `border-radius 0`,
`box-shadow 3px 3px 0 rgba(26,25,23,0.12)`, column flex.
In the mock the three cards are `flex:1` in a row with `gap 16px`; the component itself
should not set its own width.

**Label strip** — `padding 8px 10px`, `border-bottom 1px solid #D5CFC2`, row flex, `gap 8px`:
- `symbol` — serif italic 17px, `color: {color}`
- `label` — Martian Mono 9px, `letter-spacing 0.14em`, `color #7C766A`
- spacer (`flex:1`)
- an 8 × 8 px square filled `{color}` — the variable's colour swatch, flush right.

**Rotary area** — `padding 16px 10px 10px`, `display:grid; place-items:center`,
`cursor: ns-resize`, `user-select:none`, `touch-action:none`.

**Screening row** — `padding 0 12px 8px`, space-between, Martian Mono 8px,
`letter-spacing 0.12em`, `color #B3ADA0`, text `MIN` / `MAX`.

**Readout footer** — `border-top 1px solid #1A1917`, `background #EDE9E0`,
`padding 9px 10px`, centred row, `align-items:baseline`, `gap 7px`:
value in Martian Mono 15px / `letter-spacing 0.02em` / `color #1A1917`, then the unit in
Martian Mono 9px / `0.1em` / `#7C766A`.

Token names, not literals, in the implementation — these hexes are the Bench values from
`README.md` (`surface-raised`, `ink`, `hairline`, `surface`, `ink-muted`, `ink-faint`,
`accent`, `accent-hover`).

## 5. Interaction

**Vertical drag is the primary gesture** (DAW convention — never rotational following).

- `pointerdown` on the rotary area: capture `startY` and `startT`, set `dragging`,
  call `setPointerCapture` (or bind `pointermove`/`pointerup` on `window`).
- `pointermove`: `t = clamp(startT + (startY − e.clientY) / span, 0, 1)`
  where `span = e.shiftKey ? 900 : 220` pixels for the full range (shift = fine).
  Recompute `t` from `startT` each move — never accumulate deltas, that drifts.
- `pointerup` / `pointercancel`: clear `dragging`.
- Emit `update:modelValue` on every move, quantised by `step` if given. Debounce the
  *consumer's* re-render if the sketch is expensive, not the emit.

Also support:
- **Wheel** over the knob: `±1/100` of range per notch (`±1/1000` with shift);
  `preventDefault` only when the knob has pointer focus, so page scroll still works.
- **Keyboard**: `↑`/`↓` = `±1/100`, `PageUp`/`PageDown` = `±1/10`, `Home`/`End` = min/max,
  shift modifies to `±1/1000`.
- **Double-click** resets to the initial/default value.
- **Alt+click** or a click on the readout turns the footer into a text input for typing an
  exact value; `Enter` commits, `Esc` reverts.
- Cursor: `ns-resize` idle and while dragging; `document.body` gets `cursor: ns-resize`
  during drag so it doesn't flicker when the pointer leaves the card.

## 6. Accessibility

- Root of the rotary area: `role="slider"`, `tabindex="0"`, `aria-valuemin`, `aria-valuemax`,
  `aria-valuenow`, `aria-valuetext` (`"0.723"` / `"440 Hz"`), `aria-label` from `label`.
- Focus ring per the Bench spec: `outline: 2px solid #1A1917; outline-offset: 2px` —
  never a soft glow.
- `prefers-reduced-motion`: nothing to disable; the component has no transitions except
  the indicator colour swap (`150ms`), which is fine to keep.
- The knob must not be the *only* way to set a value — the typed readout satisfies that.

## 7. Nuxt integration notes

- File: `app/components/bench/BenchKnob.vue` (SFC, `<script setup lang="ts">`).
  If it proves generally useful, promote to `app/components/ds/DsKnob.vue` with the Bench
  colours coming from tokens rather than props.
- Style with Tailwind utilities + the `.bench-theme` scoped tokens from `README.md`.
  Arbitrary values are fine for the SVG-adjacent numbers; the card chrome should use the
  existing spacing scale.
- Keep the SVG inline in the SFC — it needs reactive `transform` and `stroke-dasharray`.
  Bind them as computed properties, not with inline arithmetic in the template.
- `pointermove` listeners: add on drag start, remove on drag end and in `onUnmounted`.
  Use `passive: false` on wheel.
- Add a Storybook story matching the conventions in `stories/`: the three-knob row from
  the mock (A / f / φ with their colours), plus states for disabled, log taper, and a
  270°/330° sweep comparison.
- Placement in the workspace: the knob row belongs in the visual column, directly beneath
  the rendered equation and above the canvas well — inside the same panel, separated by the
  existing `1px solid #D5CFC2` hairline. Row is `display:flex; gap:16px`; it wraps to a
  2-up grid below 900px and stacks 1-up below 600px, where the SVG drops to 88px and the
  whole card keeps a ≥44px touch target on the rotary area.

## 8. Acceptance checks

- Indicator at exactly bottom-left at min and bottom-right at max; centre tick is 12
  o'clock at `sweep = 270`.
- Value arc length matches the indicator angle at every `t` (they share `t` — never
  compute them from separate sources).
- Dragging 220px bottom-to-top traverses the full range; with shift held it moves ~1/4 of
  that; releasing shift mid-drag does not jump the value.
- Readout, `aria-valuenow`, and the equation variable stay in lockstep during a drag.
- Zero border radius anywhere; no gradients, no blurred shadows.
