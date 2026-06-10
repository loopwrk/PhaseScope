# PhaseScope — Handover to Claude Code

You are taking over a Nuxt visualiser mid-flight. The previous agent (Cowork, a
Claude agent **without** the ability to run or render the app) built out a design
system and wired it into the live page entirely from specs, tokens, and the
user's screenshots — never seeing it rendered. **You can run a dev server and
actually look at the result, which is exactly the capability that was missing.**
The goal of this handover is to make the seam invisible: pick up with full
context and finish the job — most importantly, a **visual-fidelity pass against
the Claude Design hand-off**.

Read this top to bottom, then `design/IMPLEMENTATION_PLAN.md` and
`app/components/ds/README.md`, before changing anything.

---

## 1. What this app is

- **Nuxt 4 / Vue 3.5** single-purpose app: a **Three.js + Web Audio** visualiser
  ("PhaseScope") that renders audio as a 3D point/line corridor, sphere, or
  Lorenz attractor you can fly through.
- One real page: **`app/pages/phasescope.vue`** (~1300 lines: the engine glue +
  the full-bleed layout). `/` does a server redirect to `/phasescope`.
- The visualiser route is rendered **client-only** (`routeRules['/phasescope'].ssr = false`)
  because it's pure browser tech; this deliberately avoids SSR hydration
  mismatches from `matchMedia`, colour mode, and WebGL.

### The engine is off-limits unless asked
Do **not** refactor the Three.js / audio core while doing design work. Treat these
as a black box: `useThree`, `useCorridorRenderer`, `useWavPlayer`,
`useKeyboardMovement`, `usePointerLockCamera`, `useOscillation`,
`useDreamBackground`, `useHeavenlyBackground`, `useDemoTracks`, and the
`experimental/` composables, plus the large `<script>` block in
`phasescope.vue`. The design work lives in the CSS tokens, the `ds/` and
`layout/` components, and the template.

---

## 2. The design system (what's already built)

Implemented from a Claude Design hand-off bundle. Aesthetic thesis (verbatim from
the plan): *near-monochrome cool chrome over a vivid live canvas; **one luminous
accent** does almost all chrome colour work; flat **chamfered** (`clip-path`)
corners, never rounded; technical uppercase mono micro-labels with wide tracking;
a **luminous focus ring** is the signature detail; dark "spaceship-dashboard"
first.*

- **Tokens → `@theme` → Nuxt UI `--ui-*` bridge.**
  - `app/assets/css/tokens.css` — semantic tokens. `:root` = **dark (default)**,
    `.light` = light (coherent, opt-in, mostly placeholder for now).
  - `app/assets/css/tokens/palettes.css` — swappable brand anchors. Default is
    **`azure`** (`--brand-blue: #3d7bff`). Palette is orthogonal to light/dark.
  - `app/assets/css/tokens/{effects,fonts,utilities}.css` — glow/shadow, fontsource
    imports (Space Grotesk / Inclusive Sans / JetBrains Mono), and utilities
    (`.ps-glass`, `.ps-label`, `.ps-readout`, `.ps-chamfer`, `.ps-striation`).
  - `app/assets/css/main.css` — Tailwind v4 `@theme`, the token→`--ui-*` bridge,
    colour ramps, base styles, reduced-motion handling.
- **Primitives** in `app/components/ds/`: `Button`, `IconButton`, `Badge`,
  `Switch`, `Slider`, `RadioGroup`, `Checkbox` (Nuxt UI skins via the `:ui` slot),
  plus bespoke `KeyCap`, `Readout`, `Panel`, `Logo`. Conventions in
  `app/components/ds/README.md` — **read it**.
- **Compositions** in `app/components/layout/`: `AppHeader`, `TransportBar`,
  `DisplayPanel`, `AdvancedPanel`, `ControlsOverlay`. All **controlled**
  (state owned by `phasescope.vue`, passed via props / `v-model`, changes emitted
  back). They float over the canvas as glass.
- **Storybook** stories in `stories/` for every primitive + most compositions.

### Conventions you must follow
- **Colours in oklch**, with the hex equivalent in a trailing comment.
- **Tailwind v4 `(--var)` shorthand**, not `[var(--…)]`. Arbitrary *properties*
  still use brackets (`[clip-path:var(--clip-chamfer-md)]`). **Math inside
  arbitrary values needs underscores** so valid CSS is emitted, e.g.
  `max-h-[calc(100svh_-_12rem)]`, `w-[min(100vw_-_2rem,18rem)]` — without the
  underscores the CSS is invalid and silently dropped.
- **Skin Nuxt UI** through the `:ui` slot where a component exists; go bespoke
  only when it doesn't. Don't split a component half-utility/half-scoped-CSS.
- **Prettier**: 4-space indent, single quotes, printWidth 120. Run
  `npx prettier --write` on touched files; the repo is Prettier-clean.

---

## 3. ⚠️ Known issue #1 — the accent is half-green (fix this first)

**Symptom:** chrome colour is split. Sliders, radios and focus rings are the
correct **azure** (those are hand-tuned `ds/` skins that set token classes
directly). But the **logo, switches, primary buttons (play / Load Audio) and the
header icons render Nuxt UI's default _green_.** This breaks the single most
important rule of the aesthetic ("one luminous accent").

**Root cause:** Nuxt UI's primary colour was **never wired to our accent** (it was
deferred during the design phase and not finished). Concretely:
- `app/assets/css/main.css` defines `--color-secondary-*` and `--color-warning-*`
  ramps but **no `--color-primary-*` ramp**.
- `app/app.config.ts` has **no `ui.colors.primary`**, so Nuxt UI v4 falls back to
  its built-in default (green). The `--ui-primary: var(--accent)` lines in
  `main.css` are not sufficient on their own in v4.

**Suggested fix (verify by rendering):**
1. Add a `--color-primary-50 … 950` ramp in the `@theme` block of `main.css`,
   `color-mix`-ed from `--accent` (copy the existing `--color-secondary-*` /
   `--color-warning-*` pattern exactly).
2. Register it in `app/app.config.ts`: `ui: { colors: { primary: 'primary', neutral: 'neutral' /* if defined */ }, …keep existing prose/toast/button slots… }`.
3. Run the app and confirm the logo, switches, play button and header icons are
   all azure, and that hover/active/focus states still read correctly. Check a
   palette swap too (set `<html data-palette="magenta">`) — everything chrome
   should retint together.

This one fix will move the whole UI noticeably closer to the design.

---

## 4. ⚠️ Known issue #2 — design fidelity (the main task)

The previous agent built **spec-correct primitives and a plausible arrangement**,
but **never compared the running app to Claude Design's actual mockups**. So the
structure is right (chamfers, mono labels, glass, dark, focus glow) but the look
is only approximate. The user has a **new Claude Design link** to give you.

Process to run:
1. Fetch the new Claude Design hand-off; read its readme / engineering-spec and
   study the **mockups / React prototypes**.
2. Start the dev server, **take screenshots**, and put them side by side with the
   comps. Produce a concrete gap list before editing.
3. Iterate visually. Likely gaps to scrutinise (previous agent's hunches, unverified):
   - Chrome probably reads **heavier / boxier** than the intended restrained HUD;
     panel density, widths, padding, and the glass translucency vs the canvas
     vignette likely need tuning.
   - The **empty / no-audio state** is bare — the comps may show an idle/hero state.
   - Typographic scale & rhythm, label tracking, spacing.
   - Logo treatment and header composition.
4. Keep everything token-driven (don't hardcode colours/sizes); extend tokens if
   the comps need values we don't have.

---

## 5. Outstanding TODO (agreed with the user, not yet done)

- **Accessibility / keyboard pass** (a core design goal — "fully keyboard
  navigable"): focus order across the floating chrome, ARIA on the new segmented
  camera/speed controls in `ControlsOverlay`, the skip-link target, and a
  `focus-visible` audit of the signature glow ring.
- **Motion polish** (plan §2.8): panels rise+fade on mount; canvas slow-zoom while
  playing; one ambient loop — all gated behind `prefers-reduced-motion` (the
  discipline already exists in `main.css`).
- **Storybook gap:** `AdvancedPanel` has no story; consider a full-page
  composition story.
- **Light mode** is intentionally deferred (architecture supports it via `.light`).
  Note `app/app.vue` currently **pins dark** (`colorMode.preference = 'dark'` in
  `onMounted`) — a stopgap so Nuxt UI's `.dark` class is reliably applied and to
  overwrite a stale persisted `'light'` from old code. When light mode is built,
  replace this pin with a real toggle.

---

## 6. Session changelog (most recent first) — context/history

All by the previous (non-rendering) agent; verified only via Prettier + grep, not
by rendering:
- Retired legacy code: deleted the old Tone.js playground (`index.vue`,
  `oscilloscope.vue`, `PlayPauseButton.vue`, `usePlayAudio`), the dead auth path
  (`login.vue` → nonexistent `/serpent`, no-op `auth.global.ts`, `useSimpleAuth`),
  the stale "PhaseFold" `default` layout + `ColorModeToggle`, and orphan
  `Heading.vue`. Added `/` → `/phasescope` redirect.
- Fixed a demo-track audio regression: selecting a track only **loaded** it; now
  `@select-track` → `handleSelectDemoTrack` → `playAutoTrackAtIndex` (load **and**
  play). Worth re-verifying audio actually starts now that you can run it.
- Route-level SPA for `/phasescope` (`ssr: false`) to remove hydration mismatches.
- Mobile pass: header gained a settings toggle with active-state styling; side
  panels collapse on phones via a breakpoint `watch`, are mutually exclusive on
  mobile, and use fluid widths; transport dock wraps; wordmark hides < 640px.
- Full-bleed layout: fixed full-viewport canvas, floating glass chrome (header
  top, controls HUD left, settings stack right, transport dock bottom), canvas
  scrim/vignette. Page opted out of the site layout (`definePageMeta({ layout: false })`).
- `ControlsOverlay` made live: interactive Camera (Free/Follow/Orbit) and Speed
  (Slow/Med/Fast) segmented controls reflecting engine state, plus a WASD pad that
  lights while moving.
- `AdvancedPanel` extracted from the old inline "Advanced options" box.
- New `Logo` (eye/almond enclosing a lemniscate) + SVG favicon.
- Earlier phases: token foundation, fonts, Storybook + Nuxt UI wiring, the
  primitive batches, and the first layout integration.

---

## 7. Environment notes

- The previous agent's sandbox had **no npm registry access**, so it could never
  `npm install`, run the dev server, or run Storybook — hence the blind spot.
  `node_modules` is present (macOS-built). You should be able to run things
  normally.
- Useful commands: `npm run dev` (app), Storybook script in `package.json`,
  `npx prettier --write <files>`, and `npx vue-tsc --noEmit` for types (the
  previous agent couldn't run the last two reliably in-sandbox).
- Stack specifics: Nuxt UI **v4** (used as a Nuxt module here), Tailwind **v4**
  (CSS-first `@theme`), Storybook 10 (`@storybook/vue3-vite`).

---

## 8. Key file map

| Path | Role |
| --- | --- |
| `app/pages/phasescope.vue` | The live app: engine glue + full-bleed layout/template |
| `app/components/ds/` | Design-system primitives (+ `README.md` = conventions) |
| `app/components/layout/` | Controlled layout compositions |
| `app/assets/css/tokens.css` | Semantic tokens; `:root` dark, `.light` light |
| `app/assets/css/tokens/palettes.css` | Swappable brand anchors (default `azure`) |
| `app/assets/css/main.css` | `@theme`, token→Nuxt UI bridge, ramps, base, motion |
| `app/app.config.ts` | Nuxt UI config — **needs `ui.colors.primary`** |
| `nuxt.config.ts` | routeRules (`/` redirect, `/phasescope` SPA), colorMode, head |
| `design/IMPLEMENTATION_PLAN.md` | Original plan + locked decisions + design facts |
| `stories/` | Storybook |
