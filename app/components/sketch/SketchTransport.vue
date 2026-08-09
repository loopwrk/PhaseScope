<script setup lang="ts">
const BARS = Array.from({ length: 64 }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(i * 0.35) * Math.sin(i * 0.11)));
/* Meter: segments 1-5 lit ink, 6 peak yellow, 7-8 unlit hairline. */
const METER = ['lit', 'lit', 'lit', 'lit', 'lit', 'peak', 'off', 'off'] as const;
const meterClass = { lit: 'bg-(--text)', peak: 'bg-(--accent)', off: 'bg-(--border)' };
</script>

<template>
    <footer
        class="flex items-center gap-[18px] border-t border-(--border-strong) bg-(--surface-elevated) px-[18px] py-3.5"
    >
        <div class="flex border border-(--border-strong)">
            <button
                type="button"
                class="grid h-11 w-12 cursor-pointer place-items-center bg-(--accent) transition-colors duration-(--motion-duration-fast) hover:bg-(--sketch-accent-hover)"
                aria-label="Play"
            >
                ▶
            </button>
            <button
                type="button"
                class="grid h-11 w-12 cursor-pointer place-items-center border-l border-(--border-strong) bg-(--surface) transition-colors duration-(--motion-duration-fast) hover:bg-(--bg)"
                aria-label="Stop"
            >
                ■
            </button>
            <button
                type="button"
                class="grid h-11 w-12 cursor-pointer place-items-center border-l border-(--border-strong) bg-(--surface) transition-colors duration-(--motion-duration-fast) hover:bg-(--bg)"
                aria-label="Arm loop"
            >
                ↻
            </button>
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div class="relative h-[38px] border border-(--border-strong) bg-(--surface-sunken)">
                <svg
                    class="h-full w-full"
                    preserveAspectRatio="none"
                    :viewBox="`0 0 ${BARS.length} 2`"
                    aria-hidden="true"
                >
                    <rect
                        v-for="(bar, i) in BARS"
                        :key="i"
                        :x="i + 0.15"
                        :y="1 - bar"
                        width="0.7"
                        :height="bar * 2"
                        class="fill-(--text-faint)"
                    />
                </svg>
                <span class="absolute inset-y-0 left-[35%] w-0.5 bg-(--text)" aria-hidden="true" />
            </div>
            <div
                class="flex justify-between font-mono text-(length:--sketch-font-size-micro) tracking-label text-(--text-muted)"
            >
                <span>LOOP 0:02.1 — 0:08.4</span>
                <span>44.1 KHZ · STEREO</span>
            </div>
        </div>

        <span class="font-mono text-(length:--sketch-font-size-time) font-medium tracking-[0.02em]">
            0:04<span class="text-(--text-muted)">.48</span>
        </span>

        <div class="flex w-24 shrink-0 flex-col gap-1">
            <div v-for="row in 2" :key="row" class="flex h-[9px] gap-[3px]">
                <span v-for="(seg, i) in METER" :key="i" class="flex-1" :class="meterClass[seg]" />
            </div>
            <span class="font-mono text-(length:--sketch-font-size-nano) tracking-label-wide text-(--text-muted)">
                OUT −6.2 DB
            </span>
        </div>
    </footer>
</template>
