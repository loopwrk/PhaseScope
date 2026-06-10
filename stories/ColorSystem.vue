<script setup lang="ts">
import { computed } from 'vue';

type PaletteId = 'azure' | 'magenta' | 'violet' | 'rhuby' | 'morpheus' | 'blink';

const props = withDefaults(defineProps<{ palette?: PaletteId }>(), {
    palette: 'azure',
});

// Brand anchors per palette (mirrors tokens/palettes.css) so the hex
// labels stay accurate when the palette is switched. The swatches
// themselves reskin via the [data-palette] attribute on the wrapper.
const brandHex: Record<PaletteId, { blue: string; secondary: string }> = {
    azure: { blue: '#3D7BFF', secondary: '#B327C9' },
    magenta: { blue: '#FF2D9B', secondary: '#7C5CFF' },
    violet: { blue: '#7C5CFF', secondary: '#B327C9' },
    rhuby: { blue: '#8c205c', secondary: '#591642' },
    morpheus: { blue: '#267341', secondary: '#05402f' },
    blink: { blue: '#8c0f77', secondary: '#a31ba5' },
};

const brand = computed(() => [
    { name: 'brand-blue', varName: '--brand-primary', hex: brandHex[props.palette].blue, fg: 'var(--on-brand)' },
    { name: 'brand-secondary', varName: '--brand-secondary', hex: brandHex[props.palette].secondary, fg: '#fff' },
    { name: 'on-brand', varName: '--on-brand', hex: '#FFFFFF', fg: '#111' },
]);

const spectrum = [
    { name: 'scope-magenta', varName: '--scope-magenta', hex: '#FF2D9B', use: 'live / active signal' },
    { name: 'scope-cyan', varName: '--scope-cyan', hex: '#2FD4E6', use: 'treble / highlight' },
    { name: 'scope-amber', varName: '--scope-amber', hex: '#FF9D2E', use: 'bass / energy' },
];

const state = [
    { name: 'success', varName: '--success', soft: '--success-soft', fg: '#0a0a0a', hex: '#22c58b' },
    { name: 'warning', varName: '--warning', soft: '--warning-soft', fg: '#0a0a0a', hex: '#edcd00' },
    { name: 'error', varName: '--error', soft: '--error-soft', fg: '#fff', hex: '#ff3b5c' },
    { name: 'info', varName: '--info', soft: '--info-soft', fg: '#fff', hex: '#3D7BFF' },
];

const surfaces = [
    { name: 'bg', varName: '--bg', hex: '#06080F' },
    { name: 'sunken', varName: '--surface-sunken', hex: '#04050A' },
    { name: 'surface', varName: '--surface', hex: '#0C0F18' },
    { name: 'elevated', varName: '--surface-elevated', hex: '#12161F' },
];

const text = [
    { name: 'text', varName: '--text', hex: '#E7EAF3', size: '17px' },
    { name: 'text-muted', varName: '--text-muted', hex: '#9097A8', size: '15px' },
    { name: 'text-faint', varName: '--text-faint', hex: '#5C6273', size: '14px' },
];
</script>

<template>
    <div class="page" :data-palette="palette">
        <header class="head">
            <p class="kicker">Core concepts</p>
            <h1>Colours</h1>
            <p class="lede">
                Near-monochrome cool chrome over a vivid canvas. One luminous accent does almost all the chrome colour
                work; the spectrum trio is fenced off for data and live-signal cues only.
            </p>
        </header>

        <!-- Brand -->
        <section>
            <p class="ps-label">Brand</p>
            <p class="caption">Luminous azure accent + magenta-violet secondary.</p>
            <div class="row">
                <div
                    v-for="s in brand"
                    :key="s.name"
                    class="sw tall"
                    :style="{ background: `var(${s.varName})`, color: s.fg }"
                >
                    <span class="sw-name">{{ s.name }}</span>
                    <span class="sw-hex">{{ s.hex }}</span>
                </div>
            </div>
        </section>

        <!-- Spectrum -->
        <section>
            <p class="ps-label">Spectrum accents</p>
            <p class="caption">From the visualiser. Data / live-signal cues only - never ordinary chrome.</p>
            <div class="row">
                <div
                    v-for="s in spectrum"
                    :key="s.name"
                    class="sw tall"
                    :style="{ background: `var(${s.varName})`, color: '#0a0a0a' }"
                >
                    <span class="sw-name">{{ s.name }}</span>
                    <span class="sw-hex">{{ s.hex }} &middot; {{ s.use }}</span>
                </div>
            </div>
        </section>

        <!-- State -->
        <section>
            <p class="ps-label">State</p>
            <p class="caption">
                success / warning / error / info, each with a soft tint. Always paired with a glyph or label - never
                colour alone.
            </p>
            <div class="row">
                <div v-for="s in state" :key="s.name" class="col">
                    <div class="sw" :style="{ background: `var(${s.varName})`, color: s.fg }">
                        <span class="sw-name">{{ s.name }}</span>
                        <span class="sw-hex">{{ s.hex }}</span>
                    </div>
                    <div class="soft" :style="{ background: `var(${s.soft})` }">
                        <span class="sw-name soft-name">soft</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- Surfaces -->
        <section>
            <p class="ps-label">Surfaces (dark)</p>
            <p class="caption">Near-black graphite elevation ladder: sunken &rarr; surface &rarr; elevated.</p>
            <div class="row">
                <div
                    v-for="s in surfaces"
                    :key="s.name"
                    class="sw tall bordered"
                    :style="{ background: `var(${s.varName})` }"
                >
                    <span class="sw-name">{{ s.name }}</span>
                    <span class="sw-hex muted">{{ s.hex }}</span>
                </div>
            </div>
        </section>

        <!-- Text & border -->
        <section>
            <p class="ps-label">Text &amp; border</p>
            <p class="caption">
                Cool near-white text + hairline dividers. On glass, copy uses
                <code>--text</code> (never <code>--text-muted</code>) to clear AA.
            </p>
            <div class="grid">
                <div class="stack">
                    <div v-for="t in text" :key="t.name" :style="{ color: `var(${t.varName})`, fontSize: t.size }">
                        {{ t.name }} <span class="tag">{{ t.hex }}</span>
                    </div>
                </div>
                <div class="bars">
                    <div class="bar b-border"><span class="tag muted">border</span></div>
                    <div class="bar b-strong"><span class="tag muted">border-strong</span></div>
                    <div class="bar b-sel"><span class="tag">selection</span></div>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.page {
    min-height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
}
.head .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-caption);
    letter-spacing: var(--label-tracking-wide);
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 var(--space-2);
}
.head h1 {
    font-family: var(--font-display);
    font-size: var(--font-size-display);
    line-height: var(--line-height-tight);
    margin: 0 0 var(--space-3);
}
.head .lede {
    color: var(--text-muted);
    max-width: 64ch;
    line-height: var(--line-height-normal);
    margin: 0;
}
section .caption {
    color: var(--text-muted);
    font-size: var(--font-size-detail);
    margin: var(--space-1) 0 var(--space-3);
    max-width: 64ch;
}
.row {
    display: flex;
    gap: var(--space-3);
}
.col {
    flex: 1;
}
.sw {
    flex: 1;
    position: relative;
    clip-path: var(--clip-chamfer-md);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: var(--space-3);
    box-sizing: border-box;
    height: 64px;
}
.sw.tall {
    height: 116px;
}
.sw.bordered {
    border: var(--hairline) solid var(--border);
}
.sw-name {
    font-family: var(--font-mono);
    font-size: var(--font-size-caption);
    letter-spacing: var(--label-tracking);
    text-transform: uppercase;
}
.sw-hex {
    font-family: var(--font-mono);
    font-size: var(--font-size-caption);
    margin-top: 2px;
    opacity: 0.85;
}
.sw-hex.muted {
    color: var(--text-muted);
    opacity: 1;
}
.soft {
    margin-top: var(--space-2);
    height: 36px;
    clip-path: var(--clip-chamfer-sm);
    border: var(--hairline) solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 var(--space-3);
    box-sizing: border-box;
}
.soft-name {
    color: var(--text);
}
.grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: var(--space-5);
    align-items: center;
}
.stack > div {
    margin-bottom: var(--space-2);
}
.tag {
    font-family: var(--font-mono);
    font-size: var(--font-size-caption);
    opacity: 0.7;
}
.tag.muted {
    color: var(--text-muted);
    opacity: 1;
}
.bars .bar {
    height: 30px;
    margin-bottom: var(--space-2);
    display: flex;
    align-items: center;
    padding: 0 var(--space-3);
    box-sizing: border-box;
}
.b-border {
    border: var(--hairline) solid var(--border);
}
.b-strong {
    border: var(--hairline) solid var(--border-strong);
}
.b-sel {
    background: var(--selection-bg);
    color: var(--selection-fg);
}
code {
    font-family: var(--font-mono);
    font-size: 0.92em;
}
</style>
