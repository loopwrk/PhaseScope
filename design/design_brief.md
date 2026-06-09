You are helping design the visual system for PhaseScope, and your output will be
handed to a separate engineer to implement. Optimize everything you
return for direct implementation against the existing token architecture below -
keyed to exact token names, not loose descriptions. Please view tokens.css and main.css in app folder for further clarification.

Please view files inside the design folder in the root.

## What PhaseScope is

A real-time 3D audio visualizer (Nuxt 4 + Three.js). The screen is a full-bleed
WebGL canvas painting the audio as colorful geometry; the UI is a thin chrome
layer floating over it (buttons, sliders, a popover for "Advanced Options",
toasts, a switch, and a controls overlay). The visualization itself is the only
thing that should carry strong color — the UI chrome should stay near-monochrome
so it frames the art rather than competing with it. The UI is a single page, no menus or modals.

## Aesthetic target

Minimal, edgy, retro-futuristic — a restrained HR-Giger / biomechanical / sci-fi spacechip dashboard / vintage oscilloscope / matrix code / space-time grid feel:
Flat chamfered (clip-path) corners rather than rounded
radii, fine texture/striation used sparingly, technical/uppercase micro-labels
with wide letter-spacing, and a luminous focus ring as a signature element.
Suggestive, not literal — no overt biomechanical imagery.

## Design choices

Form and function go hand in hand, like an outdoor jacket converted for an alien techno-city with a stormy atmosphere. Modern functional choices based on real UI/UX research should be in place without it having a boring design system feel - you can break out of this somewhat if this causes you to feel to constrained. Think of the panels like you might be designing them for a device that would be used in the examples listed in the aesthetic target section.

## Tech + architecture constraints (do not break these)

- Nuxt UI 4 (on Reka UI) + Tailwind v4 (CSS-first @theme).
- Single source of truth is `tokens.css`. Flow is: tokens.css -> Tailwind @theme
  -> Nuxt UI `--ui-*` variables. Do not hard-code colors outside tokens. Nuxt UI is highly customisable, so we have room to be creative, however don't suggest the impossible or anything that is impossible to implement accessiblity features for.
- Light is the current default on `:root`; dark is an empty `.dark {}` placeholder.
- Brand/state color ramps (50–950) are generated via
  `color-mix(in oklch, <base>, white|black)`. So for colored tokens, give me a
  single base value per color (the 500 anchor) unless you specifically want a
  hand-tuned ramp, in which case give all 11 stops.
- Express all colors in oklch(preferred) or hex.
- Accessibility is a hard requirement: full keyboard navigability, visible
  `:focus-visible` states, WCAG AA contrast (verify worst-case text-on-glass),
  and state must never be conveyed by color alone.
- Reduced-motion is already handled in code; do NOT add forced-colors or
  prefers-reduced-transparency handling (deliberately out of scope).

## These token slots are waiting to be filled (give values for BOTH light + dark)

Mode-independent: --brand-blue, --brand-secondary, --warning, --on-brand,
--selection-bg, --selection-fg
Per-mode (light :root + dark .dark): --accent, --text, --bg, --border
Placeholders to define: --success, --success-soft, --warning-soft, --error,
--error-soft, --info, --info-soft, --surface, --surface-elevated,
--surface-sunken, --scrim, --overlay-bg, --overlay-blur, --overlay-opacity,
--focus-ring, --focus-ring-width, --focus-ring-offset
Typography (confirm or adjust the existing scale): --font-size-caption (11px),
--font-size-detail (13px), --font-size-body (14px), --font-size-heading (16px),
--font-size-title (20px), --font-size-display (28px), --label-tracking (0.08em).
Current font is "Inclusive Sans" — recommend keeping or replacing, and if
replacing, name the font and how to obtain it (e.g. @fontsource package).

## Provided

- design/mood_board_images: A mood board (images inside named folders)
- design/generated_img_screenshots: Screenshots of what the app produces, you may also use these for inspiration
- design/swatches a set of brand color swatches (design/swatches) to choose from, however you are welcome to create your own
- design/current_design: screenshots of the current design and layout
- app/assets/css current tokens.css and main.css. Derive your palette FROM the mood board and swatches;
  pick the brand colors from the swatches rather than inventing new ones.

## Deliverables

Complete each step one at a time, asking clarifying questions beforehand.

### Stage 1

The 'creative' stage where we create a series of ideas, the equivalent to a storyboard if it were a film, or concept art if it were a game e.g. some mock components in various design treatments as well as overall layouts, example componetns for the various design ideas and extended swatches. All of this should be done in various interpreations of the brief so that I can choose what I like or ask for variations. We will come to the right design by process of refinement and elimination.

Please return 4 distinct design ideas/directions.

### Stage 2

You will create the design system for the chosen design direction The swatches and where each colour should be ued and for what, the typography and use cases for different fonts, font weights and font colours, a mock layout for the single page SPA and a number of mock components as well as everything else required for a complete design system.

### Stage 3 (return all of these)

1. A drop-in CSS block for tokens.css: the filled placeholder values plus the
   `.dark {}` body, using the EXACT token names above, ready to paste.
2. A short design-spec document (Markdown) covering:
    - the color story and which swatch became which role,
    - focus-ring spec (color/width/offset, light + dark),
    - glass/overlay spec (blur radius in px, opacity, scrim) and where it applies,
    - shape language: exact chamfer/clip-path geometry (or radius values) — if this
      needs new tokens (e.g. --shape-chamfer), propose the names explicitly,
    - motion notes (any easing/duration tweaks or glow effects; keep the existing
      reduced-motion discipline),
    - per-component direction for the Nuxt UI pieces in use (button, slider,
      popover, toast, switch) and the controls overlay, including hover / active /
      disabled / focus-visible states.
3. A WCAG AA contrast check: list the key foreground/background pairs (especially
   text over glass at its busiest) with pass/fail.
4. Dark-mode mockups (images) for human review.
5. An explicit list of any NEW tokens you are introducing beyond the slots above,
   with names and rationale, so they can be added to the architecture rather than
   improvised.
