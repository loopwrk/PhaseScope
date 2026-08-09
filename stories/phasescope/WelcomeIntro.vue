<script setup lang="ts">
// Smoke story: confirms Storybook builds and the token CSS is loaded
// (the accent + focus glow below come straight from the design tokens).
</script>

<template>
    <div class="welcome">
        <p class="kicker">PhaseScope Design System</p>
        <h1>Foundations live in Storybook</h1>
        <p class="lede">
            Token-driven, dark-primary. Browse <strong>Foundations / Colours</strong>
            for the palette and its intended uses.
        </p>
        <button class="chip">Accent &amp; focus glow</button>
    </div>
</template>

<style scoped>
.welcome {
    min-height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
    padding: var(--space-7) var(--space-6);
}
.kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-caption);
    letter-spacing: var(--label-tracking-wide);
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 var(--space-3);
}
h1 {
    font-family: var(--font-display);
    font-size: var(--font-size-display);
    line-height: var(--line-height-tight);
    margin: 0 0 var(--space-3);
}
.lede {
    color: var(--text-muted);
    max-width: 46ch;
    line-height: var(--line-height-normal);
}
.chip {
    margin-top: var(--space-5);
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-display);
    font-weight: var(--font-weight-semibold);
    color: var(--on-brand);
    background: var(--accent);
    border: 0;
    clip-path: var(--clip-chamfer-md);
    box-shadow: var(--shadow-glow-accent);
    cursor: pointer;
}
.chip:focus-visible {
    outline: none;
    box-shadow: var(--focus-glow);
}
</style>
