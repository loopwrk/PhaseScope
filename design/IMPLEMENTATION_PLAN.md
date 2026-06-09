# PhaseScope — Design System Implementation Plan

Status: **draft for review**. No code changed yet.

---

## 1. Decisions locked

| Topic       | Decision                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Dark mode   | **Dark is primary / default.** Keep a coherent light mode behind `.light`-style scoping.                                  |
| Brand blue  | **Adopt the change** `#5700ED` → `#3D7BFF` (luminous azure).                                                              |
| Swatches    | Must be **easy to add and toggle at runtime**; architecture must support multiple palettes.                               |
| Fonts       | **Install** Space Grotesk + JetBrains Mono; Inclusive Sans.                                                               |
| Components  | **Recreate React prototypes as Vue / Nuxt UI** (match visuals, not structure).                                            |
| Logo        | **New simpler mark**: an eye outline (almond) containing a lemniscate (figure-8). Replaces the bundle's proposed reticle. |
| Prototyping | **Storybook** stories for layouts + components _before_ wiring into the app.                                              |

---

## 2. Design facts carried over (already decided — no clarification needed)

These come straight from the bundle's `engineering-spec.md` / `readme.md` and are
the source of truth for values.

### 2.1 Aesthetic thesis

Near-monochrome cool chrome over a vivid live canvas. One luminous accent does
almost all chrome colour work. Flat **chamfered (`clip-path`) corners**, never
rounded. Technical uppercase mono micro-labels with wide tracking. A **luminous
focus ring** is the signature detail. Dark "spaceship-dashboard" first.

### 2.2 Colour — mode-independent anchors

- `--brand-blue: #3D7BFF` (accent, focus, primary fills — the 500 anchor)
- `--brand-secondary: #B327C9` (magenta-violet, used rarely)
- `--warning: #ED3A00` (unchanged)
- `--on-brand: #FFFFFF`
- **Spectrum trio (DATA / live cues only, never ordinary chrome):**
  `--scope-magenta #FF2D9B`, `--scope-cyan #2FD4E6`, `--scope-amber #FF9D2E`
- **Semantic state anchors:** `--success #22C58B`, `--error #FF3B5C`,
  `--info: var(--brand-blue)` (`--warning` as above)
- **Selection:** `--selection-bg #FFC20A`, `--selection-fg #000000` (unchanged)

### 2.3 Colour — per-mode (dark = primary, light = coherent)

| Token                | Dark                            | Light                           |
| -------------------- | ------------------------------- | ------------------------------- |
| `--accent`           | `var(--brand-blue)`             | `var(--brand-blue)`             |
| `--bg`               | `#06080F`                       | `#FFFFFF`                       |
| `--surface`          | `#0C0F18`                       | `#F5F6F9`                       |
| `--surface-elevated` | `#12161F`                       | `#FFFFFF`                       |
| `--surface-sunken`   | `#04050A`                       | `#EBEDF2`                       |
| `--text`             | `#E7EAF3`                       | `#15171E`                       |
| `--text-muted`       | `#9097A8`                       | `#545A69`                       |
| `--text-faint`       | `#5C6273`                       | `#868C9B`                       |
| `--border`           | `#232838`                       | `#C6C9D2`                       |
| `--border-strong`    | `#343B50`                       | `#A6AAB6`                       |
| `--scrim`            | `mix(#020307 65%, transparent)` | `mix(#14161E 50%, transparent)` |
| `--overlay-bg`       | `mix(#080B12 60%, transparent)` | `mix(#FFFFFF 72%, transparent)` |
| state `*-soft`       | `mix(<state> 20%, transparent)` | `mix(<state> 14%, transparent)` |

`--overlay-blur: 14px`, `--overlay-opacity: 0.6` (shared).

### 2.4 Focus ring (signature) — `box-shadow`, not `outline`

`outline` draws a rectangle outside the chamfer; a layered `box-shadow` follows
the clipped silhouette.

```
--focus-glow:
  0 0 0 2px var(--focus-ring),                                       /* crisp ring */
  0 0 0 4px color-mix(in oklch, var(--focus-ring) 30%, transparent), /* halo */
  0 0 18px color-mix(in oklch, var(--focus-ring) 55%, transparent);  /* outer glow */
*:focus-visible { outline: none; box-shadow: var(--focus-glow); }
```

`--focus-ring: var(--brand-blue)`, width `2px`, offset `2px`. Same on every
interactive element. **Never removed.**

### 2.5 Glass / overlay

`backdrop-filter: blur(14px) saturate(1.2)` over `--overlay-bg` (~0.6 opacity),
`1px` accent-tinted hairline (`--overlay-border` = `mix(brand-blue 16%, --border)`).
**Only** for chrome floating over the live canvas (header tools, transport,
controls overlay, glass `Panel`). Solid `--surface` everywhere else. Always pair
with the canvas vignette + `--scrim` so text clears AA.

### 2.6 Shape language — chamfer

`--chamfer-sm 5px / md 9px / lg 14px`, convenience polygons
`--clip-chamfer-sm|md|lg`, and a single-cut `--clip-notch` for tab/readout strips.
A `clip-path` can't take a border, so the crisp edge is a 1px frame layered under
the clip (utility `.ps-chamfer`) or a `1px solid` border on the clipped element.
Only true radius allowed: an optional pill for a toggle thumb (chamfered here too).

### 2.7 Typography

Three families: **Space Grotesk** (display / headings / button labels),
**Inclusive Sans** (body, retained), **JetBrains Mono** (readouts, keycaps,
uppercase HUD micro-labels at tracking `0.18em`). Scale: `caption 11 → detail 13
→ body 14 → heading 16 → title 20 → display 28 → mega 44`. (Our current scale
matches up to `display`; **add `--font-size-mega 44`** and a wide
`--label-tracking-wide 0.18em`.)

### 2.8 Motion

Durations `fast 150 / base 300 / slow 750ms`; standard ease
`cubic-bezier(0.2,0.6,0.2,1)` (already in our tokens) **plus** an
`--motion-ease-out` for entrances. Panels rise+fade on mount; canvas slow-zooms
while playing; one ambient 8s decorative loop. **Keep the reduced-motion
discipline** we already implemented; **no** `forced-colors` /
`prefers-reduced-transparency` (out of scope, confirmed).

### 2.9 Shadows / texture

Dark "shadow" is mostly accent-tinted glow: `--shadow-glow-accent`,
`--shadow-glow-live`, plus `--shadow-sm/md` for elevated surfaces and a sparing
scanline `--striation` for headers/readouts/canvas grain (`overlay` blend).

### 2.10 Iconography

Iconify **`lucide`** (UI chrome) + **`mingcute`** (transport play/pause/stop) —
both already installed in our `package.json`. Keyboard hints render as **`KeyCap`
chips**, never icon buttons. No emoji / unicode-glyph icons in chrome.

### 2.11 Copy conventions

British spelling; sentence case for body/toasts; UPPERCASE + wide-tracked mono
for micro-labels/legends/headers; Title Case for control labels/buttons; numbers
first-class with units and tabular figures; technical, unhurried, no emoji.

### 2.12 New tokens introduced beyond our original slots

`--scope-magenta/-cyan/-amber`, `--text-muted/-faint`, `--border-strong`,
`--surface/-elevated/-sunken`, `--focus-glow`, `--overlay-border`,
`--chamfer-sm/md/lg` + `--clip-chamfer-*` + `--clip-notch`,
`--shadow-sm/md` + `--shadow-glow-accent/-live`, `--striation`,
`--motion-ease-out`, `--font-size-mega`, `--label-tracking-wide`, type
families/weights/line-heights.

---

## 3. Swatch / palette architecture ("easy add + toggle" requirement)

**Principle:** a _palette_ is just the set of **mode-independent brand anchors**
(`--brand-blue`, `--brand-secondary`, optionally the `--scope-*` trio). Because
our 50–950 ramps and the `--ui-*` bridge all derive from these anchors via
`color-mix`, swapping the anchors reskins the entire app automatically. Palette
and light/dark mode are **orthogonal** (mode controls surfaces/text; palette
controls brand anchors).

**Mechanism:**

- New file `tokens/palettes.css`. Default palette on `:root`; alternates under a
  `[data-palette="<id>"]` attribute selector that overrides only the anchors:
    ```css
    :root,
    [data-palette='azure'] {
        --brand-blue: #3d7bff;
        --brand-secondary: #b327c9; /* … */
    }
    [data-palette='magenta'] {
        --brand-blue: #ff2d9b;
        --brand-secondary: #7a1fd0; /* … */
    }
    ```
- `usePalette()` composable: sets `document.documentElement.dataset.palette`,
  persists via `useCookie` (SSR-safe), exposes the registry `[{ id, label,
swatch }]`.
- A `PaletteSwitcher` UI (Advanced Options or a settings popover) to toggle live.
- **Adding a palette = one `[data-palette]` block + one registry entry.** That's
  the whole contract; documented at the top of `palettes.css`.

> The brand-blue **value** change and palette mechanism are compatible: azure is
> simply the default palette's `--brand-blue`.

**Naming note (minor):** the existing Tailwind utility is `accessible-blue`; its
value becomes azure. We keep the utility name (no template churn) but its meaning
shifts. Optionally add a `brand`/`primary` alias later for clarity.

---

## 4. Implementation phases

Each phase ends with a verification gate (see §6). Order minimises risk to the
working visualiser.

### Phase 0 — Prep

- Branch `refactor/css-design-tokens` already covers the token groundwork; create
  a follow-on branch e.g. `feat/design-system-dark` for this work.
- **Audit the bundle for completeness**: diff each `tokens/*.css`, every `components/**/*.jsx`, and the UI-kit
  files against `engineering-spec.md` to find truncated/missing pieces before we
  rely on them.
- Install deps: `@fontsource/space-grotesk`, `@fontsource/jetbrains-mono`,
  Inclusive Sans (verify exact `@fontsource` name; fall back to alternative
  source if unpublished), and Storybook (`Storybook`, `@Storybook/plugin-vue`,
  `@Storybook/plugin-nuxt`, `@nuxt/test-utils` already present).

### Phase 1 — Token foundation (mostly CSS, no UI risk)

1. Extend `tokens.css`: fill our placeholder slots with the §2.2–2.3 values; add
   the §2.12 new tokens. **Dark on `:root` as default; light under `.light`.**
2. Add `tokens/palettes.css` (§3) and import it.
3. Add `tokens/effects.css` equivalents: chamfer clip-paths, `--focus-glow`,
   glass, shadows/glows, striation — ported from the bundle.
4. Typography: add `--font-display` (Space Grotesk), `--font-mono` (JetBrains
   Mono), keep `--font-sans` (Inclusive Sans); add `--font-size-mega`,
   `--label-tracking-wide`; map into `@theme` (`--font-*`, `--text-mega`, etc.).
5. Fonts: `@import` the `@fontsource` packages (self-hosted) in a `fonts` layer.
6. Bridge updates in `main.css`: add the `html.dark { --ui-* }` higher-specificity
   override the comment already anticipates; route `--ui-*` from the new tokens.
7. `nuxt.config.ts`: `colorMode` → `preference: 'dark'`, `fallback: 'dark'`,
   `htmlAttrs.class: 'dark'`. (Also fix the stale `title: "PhaseFold"` → PhaseScope.)
8. Global `*:focus-visible` → `--focus-glow`; port `.ps-chamfer/.ps-glass/
.ps-label/.ps-readout` utilities.

### Phase 2 — Storybook setup

- Add `Storybook.config.ts` with `HstVue` (+ `HstNuxt` if it cooperates with
  Nuxt 4 — see risks), `story`/`story:build` scripts, and link `styles`/tokens so
  stories render in the real theme. Smoke-test with one trivial story.

### Phase 3 — Component primitives (Vue), prototyped in Storybook first

Recreate visuals; prefer skinning Nuxt UI, build bespoke where there's no
equivalent. Each gets a Storybook story exercising all states.

| Bundle (React) | Our approach                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------- | ----- | ----------- |
| `Button`       | Skin `UButton` (chamfer, Space Grotesk, focus-glow, variants primary/secondary/ghost/danger) |
| `IconButton`   | `UButton` square icon variant                                                                |
| `KeyCap`       | **Bespoke** Vue component (mono, chamfered chip)                                             |
| `Badge`        | Skin `UBadge` (or bespoke)                                                                   |
| `Switch`       | Skin `USwitch` (chamfered track + thumb)                                                     |
| `Slider`       | Skin `USlider` (chamfered groove, glow thumb, mono readout)                                  |
| `RadioGroup`   | Skin `URadioGroup` (chamfered indicators)                                                    |
| `Checkbox`     | Skin `UCheckbox` (chamfered + animated check)                                                |
| `Panel`        | **Bespoke** chamfer/glass wrapper (`variant="solid                                           | glass | elevated"`) |
| `Toast`        | Skin `useToast`/`UToast` (notch + status rail + glyph, `role="status"`)                      |
| `Readout`      | **Bespoke** (tabular mono figures + unit)                                                    |

States to cover everywhere: default / hover / active(`translateY(1px)`) /
disabled(0.4) / `focus-visible`(`--focus-glow`); on/off for toggles; variants.

### Phase 4 — UI-kit layouts, prototyped then integrated

Build in Storybook as the bundle structures them, then integrate into the app:
`AppHeader` (logo + mode toggle), `TransportBar` (play/pause/stop, Load Audio,
demo select, elapsed `Readout`, live `Badge`), `DisplayPanel` (sliders, topology

- render-mode radios, toggles, expandable Advanced Options, perf warning),
  `ControlsOverlay` HUD (uppercase mono section labels + `KeyCap` chips), toasts.

* **Integration into `phasescope.vue`:** extract the current inline overlay markup
  (~1800-line file) into these components incrementally, leaving the Three.js /
  audio logic untouched. The live WebGL canvas stays the backdrop.
* **Canvas treatment:** apply vignette + `--scrim` + `--striation` as overlay
  layers on the canvas container (the prototypes use static frames; we use the
  live canvas). No static backdrop image.

### Phase 5 — Logo

- Author `public/` (and favicon) SVG: **almond eye outline + interior lemniscate
  (∞)**, minimal, near-monochrome with optional accent/scope dot. Replace the
  bundle's proposed reticle. Wire into `AppHeader` + favicon. Need review after.

### Phase 6 — Palette switcher UX

- Build `PaletteSwitcher` + `usePalette()` (§3); surface in settings; verify live
  swap across modes and that ramps/`--ui-*` follow.

### Phase 7 — Accessibility & polish

- Keyboard nav pass (existing shortcuts + tab order with the new components;
  ensure pointer-lock canvas doesn't trap focus; `SkipLink` still works).
- WCAG AA contrast audit against the bundle's table (esp. text-on-glass worst
  case; body uses `--text`, never `--text-muted`, on glass).
- Confirm state is never colour-only (glyph/label on every state).
- Reduced-motion: transitions gated on `no-preference`; decorative loop + canvas
  zoom off under `reduce`.

### Phase 8 — Final review

- Prettier + ESLint; `npm run dev`/`build`; Storybook visual review; optional
  dedicated review subagent for a high-stakes accessibility + diff pass.

---

## 5. Files & touch-points (anticipated)

- **New:** `app/assets/css/tokens/palettes.css`, `effects.css`, `fonts.css`
  (or sections in the existing files); `app/composables/usePalette.ts`;
  `app/components/ds/*` (KeyCap, Readout, Panel, PaletteSwitcher, …); UI-kit
  components; `Storybook.config.ts` + `*.story.vue`; `public/phasescope-mark.svg`.
- **Edited:** `app/assets/css/tokens.css`, `main.css`; `nuxt.config.ts`;
  `app/pages/phasescope.vue` (overlay extraction); existing transport components
  (`PlayPauseButton`, `StopButton`, `AudioLoaderButton`, `ColorModeToggle`).
- **Untouched:** Three.js renderers, audio composables, attractor/oscillation
  math — visual layer only.

---

## 6. Verification gates (per phase)

ASCII-only + Prettier + balanced braces on CSS; token defined==referenced;
`npm run dev` boots; Storybook renders each story; WCAG AA contrast pairs pass;
keyboard-only operation works; reduced-motion honoured. High-stakes phases (1, 7)
get an explicit double-check.

---

## 7. Risks & open items

- **Storybook + Nuxt 4.** `@Storybook/plugin-nuxt` is beta and officially targets
  Nuxt 3. If it won't run under Nuxt 4 we either (a) run Storybook against Vue
  components with Nuxt auto-imports mocked, or (b) fall back to Storybook for Vue.
  Decide at Phase 2.
- **Inclusive Sans on `@fontsource`.** Verify the package exists; if not,
- **Bundle completeness.** Phase 0 audit
  confirms which component/token files are whole before we port them.
- **Nuxt UI skinning ceiling.** If a component resists deep chamfer/glass styling,
  drop that one to headless **Reka UI** (the option we reserved) — not the whole
  kit.
- **`phasescope.vue` extraction** is invasive; do it incrementally with the
  visualiser running after each step.
- **`color-mix`/`backdrop-filter`/oklch** are modern-browser features; fine for
  current targets but worth a confirm if old browsers matter.

---

## 8. Suggested sequence summary

0 Prep/audit/install → 1 Tokens+fonts+dark-default (CSS) → 2 Storybook →
3 Primitives (story-first) → 4 Layouts → integrate into `phasescope.vue` →
5 Logo → 6 Palette switcher → 7 A11y/contrast → 8 Review.
