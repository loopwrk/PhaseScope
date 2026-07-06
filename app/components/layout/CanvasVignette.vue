<template>
    <!-- Edge vignette + striation over the canvas, under the UI: darkens the
         viewport edges so floating chrome always clears the geometry. -->
    <div
        class="pointer-events-none absolute inset-0 z-0"
        style="
            background:
                radial-gradient(
                    120% 90% at 50% 35%,
                    transparent 0%,
                    color-mix(in oklch, var(--bg) 72%, transparent) 78%,
                    var(--bg) 100%
                ),
                linear-gradient(
                    to bottom,
                    color-mix(in oklch, var(--bg) 55%, transparent),
                    transparent 22%,
                    transparent 60%,
                    color-mix(in oklch, var(--bg) 70%, transparent)
                );
        "
    />
    <div class="ps-striation pointer-events-none absolute inset-0 z-0 opacity-50 mix-blend-overlay" />
</template>
