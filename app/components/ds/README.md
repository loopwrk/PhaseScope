# PhaseScope design-system components (`ds/`)

Authoring conventions for these primitives. Keep them consistent.

## Styling

- **Tailwind utilities in the template** are the default — this is a
  Tailwind-committed project (Nuxt UI + Tailwind v4). Use the token-mapped
  theme utilities (`font-mono`, `font-display`, `text-caption|detail|body|heading|title|display|mega`,
  `tracking-label|tracking-label-wide`) plus the design tokens.

- **Use the Tailwind v4 `(--var)` shorthand for custom-property values**, NOT
  the `[var(--…)]` long form. They're equivalent; the short form is the
  recommended style (and Tailwind IntelliSense lints the long one).
    - Yes: `shadow-(--shadow-glow-accent)`, `leading-(--line-height-tight)`,
      `tracking-(--label-tracking)`, `text-(--text-muted)`, `bg-(--surface-sunken)`,
      `border-(--border-strong)`
    - No: `shadow-[var(--shadow-glow-accent)]`, etc.
    - Exception: **arbitrary properties** that have no Tailwind utility still use
      the bracket form, e.g. `[clip-path:var(--clip-chamfer-md)]`,
      `transition-[transform,box-shadow]`. There is no `(--var)` shorthand for these.

- **Scoped `<style>` only for what utilities can't express cleanly** — e.g.
  Panel's masked `::before` chamfer frame (`mask-composite: exclude`). Don't
  split a component half-utility / half-CSS; keep such components fully scoped.

## Nuxt UI skins vs. bespoke

- **Skin Nuxt UI** (Button, IconButton, Badge, Switch, Slider, RadioGroup,
  Checkbox, Toast): wrap the `U*` component, map our variants to Nuxt UI
  colour/variant, and inject chrome via the **`:ui` slot props** (e.g.
  `:ui="{ base: '…' }"`) so tailwind-variants merges our classes over Nuxt UI
  defaults (`rounded-none` / `ring-0` win).
- **Bespoke** (KeyCap, Readout, Panel): plain Vue + tokens, no Nuxt UI.

## Signature treatments (from the tokens)

- Chamfer: `[clip-path:var(--clip-chamfer-sm|md|lg)]` + `rounded-none`.
- Focus ring: `focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow)`.
- Hover glow: `hover:shadow-(--shadow-glow-accent)`; press: `active:translate-y-px`;
  disabled: `disabled:opacity-40`.
