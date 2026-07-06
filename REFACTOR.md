# Refactor candidates

A prioritised scan of the codebase for refactoring opportunities, focused on
three goals: **splitting long files into focused modules**, **removing
duplication (DRY)**, and **readability**.

Each candidate lists where it is, what the problem is, a concrete plan, and a
rough **effort / risk / payoff** read so they can be picked off independently.
Nothing here is a bug - it's all structure.

> **Methodology:** ranked by lines of code, then read for cohesion and
> duplication. The two clear outliers (`phasescope.vue`, `usePhaseGeometry`)
> are each ~3× the next file and carry several unrelated responsibilities, so
> they dominate the list.

## File sizes (top of the list)

| Lines | File                                                 |
| ----: | ---------------------------------------------------- |
|   752 | `app/pages/phasescope.vue`                           |
|   725 | `app/composables/usePhaseGeometry.client.ts`         |
|   293 | `app/composables/useCorridorRenderer.client.ts`      |
|   266 | `app/components/layout/DisplayPanel.vue`             |
|   250 | `app/composables/useLissajous3D.client.ts`           |
|   245 | `app/composables/useLiveSynth.client.ts`             |
|   242 | `app/composables/usePlaybackOrchestration.client.ts` |
|   213 | `app/utils/audio/analysis.ts`                        |

---

## Tier 1 - long files worth splitting

### 1. `app/pages/phasescope.vue` (752 lines) - the "god page" - ✅ done

> **Status:** **done** (the page is now `app/pages/index.vue` after the routing
> rework). All three script splits landed - `useLiveSession` (earlier), then
> `useDemoMenu` (+ a pure, unit-tested `buildDemoMenuItems`) and
> `useScopeShortcuts` (the whole keymap as one injected table). The panel
> choreography went further than planned into `usePanelLayout` (desktop
> defaults, phone never-stack rules, scope-entry clearing - unit-tested), and
> the template's three inline overlays became components: `ds/GlassModal`
> (the shared phone modal shell), `layout/DemoPickerOverlay` and
> `layout/SourcePicker` (which also absorbed the repeated door-button class
> string from Tier 3). Dead wiring removed along the way: the page passed
> `scope-active` / `scope-settings-open` props AppHeader never declared, and
> listened for a `toggle-scope-settings` emit it never fired. The page is down
> to ~530 lines of genuine composition-root wiring; behaviour verified by the
> new specs (`demo-menu`, `panel-layout`) plus a full desktop + mobile
> walkthrough (source picker, both demo pickers, panel exclusivity, shortcuts,
> 3D scope, live session).

The page is meant to be wiring, and its own header comment says so ("The page
is wiring"). It has outgrown that: alongside the engine assembly and the render
loop it now owns an entire **live-session state machine**, a **scripted ghost
performance**, session **narration/countdown** copy, the **demo-menu model**,
and all **keyboard-shortcut** registration. That's four or five concerns in one
`<script setup>`.

**Proposed splits:**

- **`useLiveSession` composable** - the biggest win. Move the live-input
  machinery out of the page: the `LivePhase` type and `livePhase`/`liveMode`
  state, `liveNote`, `enterLiveSetup`, `startSession`, `exitLive`, `toggleLive`,
  the narration computeds (`LIVE_CANVAS_NAMES`, `fmtSessionTime`,
  `liveProgress`, `liveProgressLabel`, `livePrimaryLine`, `liveSecondaryLine`),
  and the **ghost performance** block (`GHOST_SCORE`, `ghostActive`,
  `ghostLit`, `playGhost`, `stopGhost`). That's ~180 lines. It depends on
  `geometry`, `camera`, `synth`, `midi`, `topologyMode` - all already
  composables, so it's a clean constructor-injection extraction.
    - Optionally split the ghost into its own `useGhostPerformance` since it's a
      self-contained scripted-playback toy.
- **`useDemoMenu` (or fold into `TransportBar`)** - the `DemoMenuItem` type,
  `SEP_WHITE`/`SEP_RED`, and the `demoTrackItems` builder are presentation
  logic about how tracks group into a menu; they don't belong in the page.
- **`useScopeShortcuts`** - the ~15 `shortcuts.register(...)` calls are a flat
  block that closes over page refs. Extracting a `registerScopeShortcuts(deps)`
  keeps the keymap in one readable place (and makes it easy to surface for a
  help overlay).

**Payoff:** high - the page drops toward ~350 lines of genuine wiring.
**Effort:** medium. **Risk:** low–medium (lots of refs to thread through, but
no logic changes; verify live mode + ghost by hand afterward).

### 2. `app/composables/usePhaseGeometry.client.ts` (725 lines) - ✅ done

> **Status:** **done.** The `topologies.ts` extraction landed first (mappers,
> `TOPOLOGIES`, shared types in `app/utils/topologies.ts`), then the
> `usePointBudget` split: the point-budget computeds, thresholds and
> `formatPointCount` now live in `app/composables/usePointBudget.ts`
> (unit-tested in `point-budget.spec.ts`); the engine composes it and spreads
> it into its API, so callers see no change. The engine is ~505 lines of
> cohesive build logic.

Two distinct things live here: the **topology definitions** (pure geometry) and
the **build engine** (stateful, GPU-bound). They change for different reasons.

**Proposed split:**

- **`app/composables/topologies.ts`** - move the four frame mappers
  (`corridorFrameMapper`, `sphereFrameMapper`, `attractorFrameMapper`,
  `mobiusFrameMapper`), the `TOPOLOGIES` registry, and the supporting types
  (`TopologyMode`, `FramePoint`, `FrameMapper`, `FrameMapperFactory`,
  `OrbitParams`, `TopologyDef`). ~200 lines of **pure functions**.
    - These are already consumed externally (`useAutoCamera` imports `TOPOLOGIES`)
      and already have dedicated unit coverage (`tests/unit/topologies.spec.ts`
      exercises the mappers directly), so the extraction is test-guarded.
    - **Watch for a cycle:** the mappers need `CorridorState`/`CorridorMeta`.
      Move those shared types alongside the mappers (or into a tiny
      `topology-types.ts`) and have the engine import them, rather than the new
      module importing back from the engine. Update the two import sites
      (`useAutoCamera`, `topologies.spec.ts`).

- **Optional: `usePointBudget`** - `totalFramesForTrack`,
  `totalPointsForFullTrack`, `effectiveMaxPoints`, `pointsWarningLevel`,
  `formatPointCount` and the two threshold constants form a self-contained
  unit (~40 lines) that only reads `audio.buffer` + `corridorMeta` +
  `trackCoveragePercent`.

**Payoff:** high - separates "what the shapes are" from "how they're built";
the engine file drops to ~480 lines of cohesive build logic.
**Effort:** low–medium. **Risk:** low (pure extraction, already tested).

---

## Tier 2 - DRY

### 3. Duplicated derivative-energy ratio in `app/utils/audio/analysis.ts` - ✅ done

> **Status:** **done** - both functions now call a shared
> `derivativeEnergyRatio(changeEnergy, ampEnergy)` helper, with the contrast (3),
> silence threshold (0.001) and mid fallback (0.5) as named constants in one
> place. The ratio is scale-invariant, so each caller passes its energies at the
> scale its silence check expects (per-sample-normalised for `analyzeFrequencyBand`,
> raw sums for `analyzeLocalFrequency`) - results are bit-identical, `analysis.spec.ts`
> green.
>
> Note: the old "`analyzeFrequencyBand` is only referenced by its own tests" hunch
> was **stale** - it is live in `useLissajous3D` (the scope trail colour), so this
> was a genuine DRY, not a retire.

`analyzeFrequencyBand` and `analyzeLocalFrequency` implemented the **same idea**
twice: `sqrt(changeEnergy) / (sqrt(changeEnergy) + sqrt(ampEnergy))`, the
`* contrastMultiplier` (3), and the `midFreq` (0.5) silence fallback - now folded
into the shared helper.

**Payoff:** medium. **Effort:** low. **Risk:** low (covered by
`analysis.spec.ts`).

### 4. Mutually-exclusive skybox toggles in `phasescope.vue` - ✅ done

> **Status:** **done**, and the cleaner way: rather than enforce exclusion across
> two booleans, the backgrounds are now a single selection -
> `background: 'none' | 'dream' | 'heavenly'` in `useScopeSettings`. Each
> skybox's `enabled` is `computed(() => background.value === id)`, so "at most one
> on" is **structural**, not enforced. The panel renders one `RadioGroup`
> (None / Dream / Heavenly) instead of two checkboxes, the `b`/`n` shortcuts flip
> the selection, and the first-pass `useExclusivePair` helper was retired.
> Mutually-exclusive booleans were a radio in disguise; this is the radio.
> Adding a background = one more radio item + one `computed`.

Dream and Heavenly backgrounds were handled by two near-identical pieces
(`onDreamBgToggle`/`onHeavenlyBgToggle`, the `b`/`n` shortcuts, and the two
`@update:dream` / `@update:heavenly` handlers) all encoding the same rule. The
single-selection model removes the rule entirely. (The backgrounds themselves are
**already exemplary** - see the note below - this was only about the toggle
plumbing in the page.)

**Payoff:** low–medium. **Effort:** low. **Risk:** low.

### 5. `scripts/compose-*.mjs` - five copies of a WAV/synth engine - ✅ done

> **Status:** **done** - the shared 16-bit stereo writer now lives in
> `scripts/lib/wav.mjs` (`writeWav(L, R, { path, sampleRate })`), and the common
> constants/note math in `scripts/lib/synth.mjs` (`SR`, `TAU`, `NOTE`). Each
> composer is back to just its score + timbre and its bespoke voice helpers;
> the ~28-line RIFF tail collapsed to a one-liner in all of them.
>
> Also done as part of this pass: `confirmation-pleasure` was renamed to
> `yueji` (file, title, run command, output `fable-01-yueji.wav`, and the
> cross-reference in `still-point`), and `enfold` + `tessellate` were deleted.
> The surviving three (`chromatic-orrery`, `still-point`, `yueji`) were
> regenerated and **diffed byte-for-byte against their pre-refactor output** -
> identical (yueji's bytes match the old confirmation-pleasure exactly).

The preset composers each carried their own `writeWav`/RIFF encoder (copy-paste),
now folded into `scripts/lib/wav.mjs` + `scripts/lib/synth.mjs`.

**Payoff:** medium (big line reduction). **Effort:** medium. **Risk:** low -
these are **build-time tooling**, not shipped app code, and their output
(`public/audio/*`) was regenerated and diffed to confirm parity.

---

## Tier 3 - readability (smaller, localised)

- **`phasescope.vue` repeated class strings** - ✅ done. The source picker's
  `DsButton` costume is a constant inside `layout/SourcePicker.vue`, and the
  two floating-panel wrappers share a `SIDE_PANEL_CLASS` constant (rise
  animation + top anchor), each side adding only its own edge/stacking/size.
- **`phasescope.vue` `animate()` loop** - ✅ done. The live-vs-track build
  branch is `updateGeometryBuild()` and the oscillation-uniform write is
  `driveOscillation()`; the loop body reads as five verbs.
- **`usePhaseGeometry` `buildOneFrame`** - ✅ done (names only, as prescribed).
  The hue precedence (topology `frameHue` hook > pitch-chroma > spectrum ramp)
  is `resolveFrameHue()` - returns a primitive, so the hot path stays
  allocation-free; the per-point write loop is untouched.

---

## Explicitly leave alone (already good)

- **`createSkyboxBackground.client.ts`** - the textbook version of what Tier 1
  is reaching for: one shared factory (camera-tracking inverted sphere, shared
  noise GLSL, `enabled`-ref lifecycle), and `useDreamBackground` /
  `useHeavenlyBackground` are ~3-line files that supply only a fragment shader.
  Use this as the **pattern to copy** when splitting the larger files.
- **`useCorridorRenderer`**, **`useWavPlayer`**, **`useMidiInput`** - long-ish
  but each is a single cohesive responsibility with a clear public surface.

---

## Suggested order

1. ~~Extract `topologies.ts` from `usePhaseGeometry`~~ - **done.**
2. ~~Extract `useLiveSession` from `phasescope.vue`~~ - **done.**
3. ~~DRY the analysis helper (#3) and skybox toggles (#4)~~ - **done.**
4. ~~`useDemoMenu` / `useScopeShortcuts` (+ `usePanelLayout` and the template
   overlay components), then `usePointBudget` and the Tier 3 naming passes~~ -
   **done.** Nothing on this list remains open.
5. ~~`scripts/lib/wav.mjs` when touching the composers next~~ - **done.**

Each step is independently shippable and unit-testable; do them one PR at a time
and re-run `npm test` (the topology and analysis suites cover the riskiest
extractions).
