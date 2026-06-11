/* Segmented-control styling - the chamfered button-group treatment used by
   ControlsOverlay (camera/speed, aria-pressed buttons) and the about page's
   topology tabs (ARIA tablist). Only the LOOK is shared; semantics (button
   group vs tabs) stay at the call site, which is why this is a class module
   rather than a component. */

const core =
    'rounded-none border font-mono text-caption uppercase tracking-label transition-[transform,box-shadow,color] duration-150 [clip-path:var(--clip-chamfer-sm)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow) active:translate-y-px';

export const segBaseSm = `px-2 py-1 ${core}`;
export const segBaseMd = `px-3 py-1.5 ${core}`;
export const segActive = 'border-(--accent) text-(--accent) shadow-(--shadow-glow-accent)';
export const segIdle = 'border-(--border-strong) text-(--text-muted) hover:text-(--text)';
