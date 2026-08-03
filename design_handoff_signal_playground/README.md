# Handoff: Signal Playground (a DSP sketch bench inside PhaseScope)

## Overview

A browser playground where the author can implement things learnt on an audio signal
processing course: write code (or maths, or notes), run it, hear the audio it generates,
and see the visual it renders. It lives at its own route inside the existing PhaseScope
Nuxt app (PhaseScope itself stays at the root). It has its own visual identity — warm
paper, ink hairlines, one signal yellow — deliberately *not* PhaseScope's dark theme.

Working name in the mock: **Bench**. Rename freely.

Four screens are specified: **Workspace** (the main three-pane view), **Empty state**,
**Sketch library**, **Mobile workspace**.

## About the design files

`Signal Playground.dc.html` in this bundle is a **design reference created in HTML** — a
prototype showing intended look and layout, not production code to copy. It renders four
mockups side by side on one canvas (labelled 1a / 1b / 1c / 1d); **only 1a and the 1d
supporting screens are approved**. 1b (Rack) and 1c (Console) were rejected alternatives —
ignore them.

The task is to **recreate the approved designs in the target codebase's existing
environment** using its established patterns: Nuxt 4, Vue 3 SFCs, Tailwind CSS, Nuxt UI.
Do not port the mock's inline styles verbatim; express them as Tailwind utilities and CSS
custom properties following the conventions already in `app/assets/css/`.

## Fidelity

**High-fidelity.** Colours, typography, spacing and layout are final. Recreate pixel-
perfectly. The one thing that is *not* final is functionality depth: this is a first-pass
UI spec, not a full product spec. Where behaviour is unspecified below, build the simplest
thing that satisfies the layout and leave a clear extension point.

## Target codebase context

- Nuxt 4 + Vue 3 + TypeScript, Tailwind CSS, Nuxt UI, Three.js, Web Audio API.
- Existing tokens live in `app/assets/css/tokens.css` + `app/assets/css/tokens/*.css`
  and are consumed via Tailwind `@theme` in `main.css`. PhaseScope is dark-primary
  (`--bg: #06080f` etc.).
- Existing DS primitives in `app/components/ds/` (Button, IconButton, Panel, Slider,
  Switch, Readout, Badge, KeyCap, RadioGroup…), documented in `app/components/ds/README.md`,
  with Storybook stories in `stories/`.

**Theming approach:** do not fork the DS primitives and do not edit PhaseScope's `:root`
values. Add a scoped token block — e.g. `.bench-theme { … }` in a new
`app/assets/css/tokens/bench.css` — that re-points the same semantic token names
(`--bg`, `--surface`, `--text`, `--border`, `--accent`, `--font-sans`, `--font-mono`, …) to
the Bench palette below, and apply that class on the Bench layout root. Existing `ds/*`
components then inherit the light paper look for free. Where a primitive can't express the
hard-edged, zero-radius Bench look, add a variant to the primitive rather than a one-off.

## Route & shell

- New route: `/bench` (Nuxt page, e.g. `app/pages/bench/index.vue` for the library and
  `app/pages/bench/[id].vue` for a sketch workspace). PhaseScope keeps `/` → `/phasescope`.
- Fully separate shell. **No PhaseScope header.** The only link back is a small mono
  text link `↩ PHASESCOPE` at the far right of the Bench header.
- Sketches persist locally (no backend). Reuse the existing `usePersistedState` composable
  pattern; `localStorage` is fine.

---

## Design tokens

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#E4DFD4` | Outermost page background / behind panels |
| `surface` | `#EDE9E0` | App body, canvas well, gutter, output strip |
| `surface-raised` | `#F6F3EC` | Header, panels, transport bar, cards |
| `surface-bright` | `#FBFAF6` | Inside the visual canvas, scrub-bar well |
| `ink` | `#1A1917` | Text, all structural borders, meter segments |
| `ink-muted` | `#7C766A` | Secondary labels, meta, inactive tabs |
| `ink-faint` | `#B3ADA0` | Line numbers, canvas watermark labels |
| `hairline` | `#D5CFC2` | Internal dividers (weaker than `ink`) |
| `hairline-soft` | `#E0DACD` | Gutter edge, chart gridlines |
| `grid-dot` | `#D5CFC2` | Dotted canvas-well background |
| `accent` | `#F2C230` | Signal yellow: play, RUN, active mark, data highlight |
| `accent-hover` | `#FFD34D` | Hover on yellow fills |
| `accent-ink` | `#8A6A00` | Yellow-family text on paper (link hover, IM label) |
| `ok` | `#1F8A5C` | "ran cleanly" status dot |

Syntax colours (code panes): comment `#8A8478`, keyword `#B0553B`, number `#2B4BD6`,
type/global `#1F7A6E`, string/template `#1F7A6E`, function name `#8A6A00`, plain `#1A1917`.

Rule of thumb: **structural borders are `#1A1917` at 1px; internal dividers are `#D5CFC2`
at 1px.** Yellow is a signal, not a surface — it appears on the mark, the primary action,
the play button, the active loop region, and one series in a chart. Nothing else.

### Typography

Three families, loaded from Google Fonts:

```
Bricolage Grotesque — 400/500/600/700, optical size 12..96   → UI, headings, body
Martian Mono        — 400/500/600                            → labels, readouts, buttons
Spline Sans Mono    — 400/500/600                            → code
```

**Base font size is 18px** (set on `body`, ~1.125rem). Everything below is in px as drawn.

| Role | Family | Size | Weight | Tracking | Case |
| --- | --- | --- | --- | --- | --- |
| Page/sketch title | Bricolage | 18 | 600 | normal | as typed |
| Body copy (empty state) | Bricolage | 20 | 400 | normal, `line-height:1.45`, `text-wrap:pretty` | sentence |
| List row label | Bricolage | 17 | 400/600 | normal | sentence |
| Wordmark `BENCH` | Martian Mono | 13 | 600 | `0.06em` | upper |
| Button / tab label | Martian Mono | 11 | 400 (600 if primary) | `0.06–0.08em` | upper |
| Micro label (`CANVAS`, `OUTPUT`) | Martian Mono | 10 | 400 | `0.1em` | upper |
| Meta / chip | Martian Mono | 10 | 400 | `0.08–0.1em` | upper |
| Meter caption | Martian Mono | 9 | 400 | `0.1em` | upper |
| Time readout | Martian Mono | 22 | 500 | `0.02em` | — |
| Code | Spline Sans Mono | 14 | 400 | normal, `line-height:1.75` | — |
| Console output | Spline Sans Mono | 13 | 400 | normal | — |

Mobile drops one step: code 13/1.7, title 17, time 13, micro labels 9–10.

### Geometry

- **Border radius: 0 everywhere.** No rounded corners on panels, buttons, tabs, or fields.
  The only circles are the two status dots (7–8px) and the mark's ring glyph.
- Borders: `1px solid #1A1917` (structure), `1px solid #D5CFC2` (division).
- Panel shadow (floating cards only, e.g. the empty-state card): `5px 5px 0 rgba(26,25,23,0.12)`.
  A hard offset shadow, never a blur.
- Spacing rhythm in the mock: 6 / 10 / 12 / 14 / 16 / 18 / 22 / 26px. Map onto the existing
  `--space-*` scale where it lands cleanly.
- Control heights: 36px (compact), 44px (transport buttons — also the mobile touch minimum).
- Dotted canvas well: `radial-gradient(#D5CFC2 1px, transparent 1px)`, `background-size: 22px 22px`.

---

## Screen 1 — Workspace (approved layout "1a Bench")

Drawn at 1400 × 880. Full-viewport in production; the app body never scrolls — the three
regions flex and the code pane scrolls internally.

```
┌──────────────────────────────────────────────────────────────┐
│ header                                             48–58px   │
├───────────────────────────┬──────────────────────────────────┤
│ code column  (560px)      │ visual column (flex:1)           │
│  tab strip                │  canvas toolbar                  │
│  gutter + code (flex:1)   │  canvas well (flex:1, dotted)    │
│  output strip             │                                  │
├───────────────────────────┴──────────────────────────────────┤
│ transport bar                                       ~72px    │
└──────────────────────────────────────────────────────────────┘
```

Container: `background #EDE9E0`, `border 1px solid #1A1917`, column flex, `overflow:hidden`.

### 1.1 Header

`background #F6F3EC`, `border-bottom 1px solid #1A1917`, `padding 14px 18px`,
row flex, `align-items:center`, `gap 20px`.

Left to right:

1. **Mark + wordmark** — 30×30 square, `background #F2C230`, `border 1px solid #1A1917`,
   containing a 14×14 circle with `border 2px solid #1A1917` and `border-top-color:transparent`
   (a phase/rotation glyph). Then `BENCH` (Martian Mono 13/600, `0.06em`).
2. **Divider** — 1×26px `#D5CFC2`.
3. **Sketch identity cluster** (`flex-shrink:0; white-space:nowrap; gap 10px`):
   - sketch name, Bricolage 18/600, click-to-rename inline;
   - language chip: Martian Mono 10, `0.1em`, `padding 3px 7px`, `border 1px solid #1A1917`,
     `background #E4DFD4` — value is per-sketch (`JS`, `TEX`, `C#`, …);
   - save status, Martian Mono 10, `#7C766A`, e.g. `SAVED 2M AGO`.
4. **Spacer** (`flex:1`).
5. **Actions** (`gap 8px`):
   - `SKETCHES ▾` — Martian Mono 11, `0.08em`, `padding 8px 12px`, `background #EDE9E0`,
     `border 1px solid #1A1917`; hover `background #E4DFD4`. Opens the sketch switcher
     (dropdown listing recent sketches + "All sketches…" → library route).
   - `RUN ⏎` — same metrics, `padding 8px 14px`, `background #F2C230`, weight 600;
     hover `#FFD34D`. Primary action.
   - Divider 1×26px `#D5CFC2`.
   - `↩ PHASESCOPE` — Martian Mono 10, `0.08em`, `#7C766A`, no underline; hover `#8A6A00`.

### 1.2 Code column — 560px fixed, `border-right 1px solid #1A1917`, `background #F6F3EC`

**Tab strip** (`border-bottom 1px solid #D5CFC2`): three tabs — `CODE`, `MATHS`, `NOTES` —
Martian Mono 11, `0.08em`, `padding 11px 16px`, each `border-right 1px solid #D5CFC2`.
Active tab: `background #EDE9E0`, `border-bottom 2px solid #1A1917` with `margin-bottom:-1px`
so it covers the strip's own hairline. Inactive: `color #7C766A`. Right-aligned hint
`⌥⇧F` (Martian Mono 10, `#7C766A`, `padding 11px 14px`) — format document.

The three tabs are how the pane stays language- and content-agnostic: `CODE` is the editor
(language set per sketch), `MATHS` renders LaTeX, `NOTES` is prose. Same pane, same chrome.

**Editor body** (`flex:1`, `overflow:hidden`, row flex):
- Gutter: Spline Sans Mono 14/1.75, `color #B3ADA0`, `text-align:right`,
  `padding 16px 10px`, `background #EDE9E0`, `border-right 1px solid #E0DACD`,
  `user-select:none`.
- Code: Spline Sans Mono 14/1.75, `padding 16px 18px`, `color #1A1917`, no wrapping —
  the pane scrolls. Use the codebase's preferred editor (CodeMirror 6 is the natural
  choice; keep the theme to the syntax hexes above). No active-line highlight in the mock;
  if the editor adds one, use `#EDE9E0`.

**Output strip** (`border-top 1px solid #1A1917`, `background #EDE9E0`,
`padding 10px 16px`, row flex, `gap 14px`):
`OUTPUT` micro-label + result line in Spline Sans Mono 13
(mock copy: `ran in 12ms · 1024 samples · k=17 → 732.4 Hz`), spacer, then an 8px status dot
— `#1F8A5C` on success. On error the dot goes `#D6482B` and the line carries the message;
keep the same one-line height and let the strip grow to at most ~4 lines with internal scroll.

### 1.3 Visual column — `flex:1`, `background #EDE9E0`

**Canvas toolbar** (`padding 10px 16px`, `border-bottom 1px solid #D5CFC2`, `gap 14px`):
- `CANVAS` micro-label.
- Aspect segmented control: one bordered group (`border 1px solid #1A1917`) of four
  segments `FIT | 16:9 | 1:1 | FREE`, Martian Mono 10, `0.06em`, `padding 6px 10px`,
  segments split by `border-left 1px solid #1A1917`. Selected segment inverts:
  `background #1A1917`, `color #F6F3EC`. This is the mechanism for handling visuals of any
  shape: `FIT` letterboxes the sketch's declared ratio, `FREE` lets it fill the well.
- Spacer, then two mono readouts (`#7C766A`, 10, `0.08em`): pixel size `1024 × 576` and
  frame rate `60 FPS`.
- Two square buttons, `padding 6px 10px`, `border 1px solid #1A1917`, `background #F6F3EC`:
  `⤢` (fullscreen the canvas) and `◉ PNG` (capture frame).

**Canvas well** (`flex:1`, `padding 26px`, `display:grid; place-items:center`, dotted
background as specified in tokens). Inside sits the sketch surface: `max-width 760px`,
`aspect-ratio 16/9` in `FIT`, `background #FBFAF6`, `border 1px solid #1A1917`. The sketch
draws here (Canvas2D or WebGL). Four corner labels are chrome the sketch can set, Martian
Mono 10, `0.1em`: two series labels top-left (`RE · K=17` in `#7C766A`, `IM · K=17` in
`#8A6A00`), one parameter bottom-right (`N = 1024`, `#7C766A`).

The illustrative content in the mock (two phase-shifted sine curves, ink solid + yellow
dashed, on a `#D5CFC2` zero axis) is placeholder — the real sketch supplies it.

### 1.4 Transport bar

`border-top 1px solid #1A1917`, `background #F6F3EC`, `padding 14px 18px`, row flex,
`align-items:center`, `gap 18px`.

1. **Button group** — single `border 1px solid #1A1917`, three 48×44 cells split by
   `border-left 1px solid #1A1917`: play `▶` on `#F2C230`; stop `■` on `#EDE9E0`;
   loop `↻` on `#EDE9E0`, and when loop is armed it inverts to `background #1A1917;
   color #F2C230`. Play becomes pause `❙❙` while running.
2. **Scrub area** (`flex:1`, column, `gap 6px`):
   - 38px-tall well: `background #FBFAF6`, `border 1px solid #1A1917`. Contains the
     buffer waveform in `#B3ADA0`, the played portion overdrawn in `#1A1917`, the loop
     region as `#F2C230` at 28% opacity, the playhead as a 2px `#1A1917` rule, and loop
     handles as 1px `#1A1917` at 35% opacity. Drag to scrub; drag the handles to set loop.
   - Caption row, Martian Mono 10, `0.08em`, `#7C766A`, space-between:
     `LOOP 0:02.1 — 0:08.4` left, `44.1 KHZ · STEREO` right.
3. **Time readout** — Martian Mono 22/500: minutes+seconds in `#1A1917`, the
   hundredths (`.48`) in `#7C766A`.
4. **Output meter** — 96px column, `gap 4px`: two 9px rows of 8 segments (`gap 3px`),
   segments 1–5 `#1A1917`, 6 `#F2C230`, 7–8 unlit `#D5CFC2` (i.e. lit ink, peak yellow,
   unlit hairline), then caption `OUT −6.2 DB` (Martian Mono 9, `0.1em`, `#7C766A`).

Scope for v1: play / pause / stop, scrub, loop region, time, level meter. Source is the
buffer the sketch generated. File input, demo tracks and MIDI are later additions — leave
room to the left of the button group for a source selector.

---

## Screen 2 — Empty state

Drawn at 900 × 600. Same header (reduced: mark + `BENCH` + spacer + `↩ PHASESCOPE`,
`padding 13px 16px`; the mark here is a plain 26×26 yellow square). Body is the dotted well
with a centred card:

Card: `width 520px`, `background #F6F3EC`, `border 1px solid #1A1917`,
`box-shadow 5px 5px 0 rgba(26,25,23,0.12)`.
- Card header: `padding 14px 18px`, `border-bottom 1px solid #1A1917`,
  `NEW SKETCH` (Martian Mono 10, `0.12em`).
- Body: `padding 22px 18px 24px`, column, `gap 18px`.
  - Copy, Bricolage 20/1.45: *"Nothing on the bench yet. Start from a blank sketch, or open
    one of the starters."*
  - Starter list: a `1px` `#D5CFC2` grid (column flex, `gap:1px`, `border 1px solid #1A1917`)
    of three `#EDE9E0` rows, each `padding 13px 15px`, row flex, `gap 12px`:
    a 34px-wide language tag (Martian Mono 11), the label (Bricolage 17, `flex:1`),
    and a `→` chevron (Martian Mono 11, `#7C766A`). Rows:
    `JS — Blank canvas + audio out`, `JS — Windowed FFT scaffold`, `TEX — Maths note, no audio`.
    Hover: row `background #E4DFD4`.
  - Action row: `NEW SKETCH ⌘N` (Martian Mono 11, `0.08em`, `padding 11px 16px`,
    `background #F2C230`, `border 1px solid #1A1917`, weight 600) then
    `OR DROP AN AUDIO FILE ANYWHERE` (Martian Mono 11, `0.08em`, `#7C766A`).
- The whole viewport is a drop target; on dragover show the well tinted
  `#F2C230` at ~12% and the card border thickened to `2px`.

---

## Screen 3 — Sketch library

Drawn at 900 × 600. Route: `/bench`.

- Header: mark, `BENCH`, then breadcrumb `/ SKETCHES` (Martian Mono 11, `0.08em`,
  `#7C766A`), spacer, `NEW ⌘N` yellow button (Martian Mono 11, `padding 8px 12px`).
- Filter row (`padding 12px 16px`, `border-bottom 1px solid #D5CFC2`, `gap 10px`):
  `FILTER` micro-label; then language pills, Martian Mono 10, `0.06em`, `padding 6px 10px`
  — active `background #1A1917; color #F6F3EC` (`ALL 14`), inactive
  `border 1px solid #D5CFC2` (`JS 9`, `TEX 3`, `C# 2`); spacer; `SORT · RECENT ▾`
  (Martian Mono 10, `#7C766A`).
- Grid: `padding 18px 16px`, `grid-template-columns: repeat(3, 1fr)`, `gap 14px`,
  `align-content:start`, dotted well background. Responsive: 3 up ≥900px, 2 up ≥600px,
  1 up below.
- Card: `background #F6F3EC`, `border 1px solid #1A1917`.
  - Thumbnail: 96px tall, `background #FBFAF6`, `border-bottom 1px solid #1A1917`,
    centred kind label (Martian Mono 9, `0.12em`, `#B3ADA0`) as the fallback. Real
    implementation should store a captured PNG of the sketch's last frame and show it here.
  - Meta: `padding 10px 12px`, column, `gap 6px` — name (Bricolage 17/600), then a row
    (`gap 8px`) of the language chip (Martian Mono 9, `padding 2px 6px`,
    `border 1px solid #D5CFC2`) and relative time (Martian Mono 9, `#7C766A`).
  - Hover: `box-shadow 4px 4px 0 rgba(26,25,23,0.12)`, no movement.
  - Context actions (rename, duplicate, delete) — not drawn; put them behind a `⋯` that
    appears on hover in the meta row.

Mock data (six of fourteen): `dft-basis-sweep` JS WAVEFORM 2m ago · `window-shapes` JS
ENVELOPE yesterday · `stft-heatmap` JS SPECTROGRAM 3d ago · `fourier-theorems` TEX MATHS
4d ago · `harmonic-model` C# PARTIALS 1w ago · `lissajous-live` JS PHASE 1w ago.

---

## Screen 4 — Mobile workspace

Drawn at 390 × 844. The three regions stack; nothing is hidden.

1. **Header** — `padding 12px 14px`, `border-bottom 1px solid #1A1917`,
   `background #F6F3EC`: 22×22 yellow mark, sketch name (Bricolage 17/600), spacer,
   `≡` button (`padding 5px 8px`, `border 1px solid #1A1917`) opening a sheet with
   sketches, run, and the PhaseScope link.
2. **Canvas** — fixed 270px tall, `background #FBFAF6`,
   `border-bottom 1px solid #1A1917`, `CANVAS · FIT` label top-left (Martian Mono 9,
   `0.1em`, `#7C766A`). No toolbar; aspect control moves into the sheet.
3. **Transport** — `padding 12px 14px`, `border-bottom 1px solid #1A1917`,
   `background #F6F3EC`, `gap 12px`: a two-cell 44×44 group (play yellow, loop inverted
   ink/yellow), a 24px scrub well (`flex:1`), and a compact `0:03` readout
   (Martian Mono 13). No meter, no loop caption.
4. **Tab strip** — `CODE / MATHS / NOTES` (Martian Mono 10, `0.08em`, `padding 12px 14px`),
   active underlined as on desktop, with a yellow `RUN` cell pinned right
   (`border-left 1px solid #1A1917`, weight 600).
5. **Code** — `flex:1`, gutter + code at Spline Sans Mono 13/1.7, horizontally scrollable.
6. **Output strip** — `border-top 1px solid #1A1917`, `background #EDE9E0`,
   `padding 10px 14px`: status dot + result line (Spline Sans Mono 12, `#5C5850`).

Breakpoints: single-column stack below 900px; below 700px also collapse the canvas toolbar
into the sheet. Between 900 and 1200px keep 1a's split but let the code column shrink to
480px. All touch targets ≥44px.

---

## Interactions & behaviour

- **Run** — `RUN ⏎` or `Cmd/Ctrl+Enter`. Evaluate the sketch, (re)generate the audio
  buffer, start the render loop, write the result line to the output strip. Errors go to
  the output strip; the canvas keeps its last good frame.
- **Autorun** — off by default. If added, put the toggle in the code tab strip, not the header.
- **Transport** — `Space` toggles play/pause when focus isn't in the editor. Scrub by drag
  on the waveform well. Loop handles drag; `L` arms loop. Playhead updates from
  `AudioContext.currentTime` via `requestAnimationFrame`, not a timer.
- **Aspect** — changing the segmented control resizes the sketch surface and notifies the
  sketch (`onResize`) so it can re-render; the sketch declares a preferred ratio that `FIT` honours.
- **Tabs** — `CODE / MATHS / NOTES` swap the pane content only; state per tab is preserved.
- **Sketch switcher** — `SKETCHES ▾` dropdown, most-recent first, keyboard navigable;
  last entry links to `/bench`.
- **Rename** — click the sketch name in the header, edit in place, `Enter` commits,
  `Esc` reverts; `SAVED …` updates.
- **Persistence** — debounce writes ~500ms; the `SAVED 2m ago` label ticks.
- **Motion** — this design is nearly static. Transitions only on hover/active colour
  (`150ms`, `cubic-bezier(0.2,0.6,0.2,1)` — the existing `--motion-duration-fast` /
  `--motion-ease-standard`). No panel animation, no easing on layout. Honour
  `prefers-reduced-motion` as the codebase already does.
- **Focus** — visible focus ring on every control: `2px solid #1A1917` offset `2px`
  (never a soft glow).

## State

Per sketch: `id`, `name`, `language`, `tabs: { code, maths, notes }`, `aspect`,
`preferredRatio`, `thumbnail`, `createdAt`, `updatedAt`.
Session: `activeSketchId`, `isRunning`, `playState`, `playhead`, `loop {start,end,enabled}`,
`lastRunResult { ok, message, durationMs }`, `meterLevels`, `activeTab`, `libraryFilter`, `librarySort`.

Language-agnostic execution is the open engineering question, not a UI one: JS runs
natively (Web Worker or AudioWorklet), LaTeX renders via KaTeX/MathJax, anything needing
compilation goes through a per-language adapter. The UI only needs each language to report
`{ audioBuffer?, renderFrame?, message }` — design the runner interface around that so
languages can be added without touching these screens.

## Assets

None to import. The mark is drawn in CSS (yellow square + a 14px ring with a transparent
top border). Fonts come from Google Fonts — Bricolage Grotesque, Martian Mono, Spline Sans
Mono; self-host them the same way the project handles `Inclusive Sans` / `Space Grotesk` /
`JetBrains Mono` (see `app/assets/css/tokens/fonts.css`) rather than hotlinking.

## Files

- `Signal Playground.dc.html` — the design reference. Open it in a browser. Use option
  **1a** (top-left, badged `1a`) and the three screens badged `1d`. Ignore 1b and 1c.
