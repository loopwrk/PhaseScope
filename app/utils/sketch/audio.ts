/* Pure audio/transport maths - kept out of the composable so the loop
   arithmetic and display mappings are unit-testable without Web Audio. */

/* Downsample a sample buffer into n peak bars for the scrub well. */
export function waveformPeaks(samples: ArrayLike<number>, bars: number): number[] {
    if (samples.length === 0) return Array.from({ length: bars }, () => 0);
    const window = Math.max(1, Math.floor(samples.length / bars));
    return Array.from({ length: bars }, (_, i) => {
        let peak = 0;
        const start = i * window;
        const end = Math.min(samples.length, start + window);
        for (let s = start; s < end; s++) peak = Math.max(peak, Math.abs(samples[s]!));
        return peak;
    });
}

export interface LoopRegion {
    start: number;
    end: number;
    enabled: boolean;
}

/* Where the playhead sits after `elapsed` seconds from `offset`, given a
   loop region: linear until the loop end, then cycling inside it. */
export function loopedPlayhead(offset: number, elapsed: number, duration: number, loop: LoopRegion): number {
    const t = offset + elapsed;
    const span = loop.end - loop.start;
    if (!loop.enabled || span <= 0) return Math.min(t, duration);
    if (t <= loop.end) return t;
    return loop.start + ((t - loop.start) % span);
}

/* Root-mean-square of a time-domain byte array (128 = silence). */
export function byteRms(data: Uint8Array): number {
    if (data.length === 0) return 0;
    let sum = 0;
    for (const byte of data) {
        const v = (byte - 128) / 128;
        sum += v * v;
    }
    return Math.sqrt(sum / data.length);
}

/* Map an rms level onto n meter segments (last two stay headroom). */
export function litSegments(rms: number, segments = 8): number {
    if (rms <= 0) return 0;
    /* -48dB..0dB across the scale, so quiet material still registers. */
    const db = 20 * Math.log10(rms);
    const fraction = Math.min(1, Math.max(0, (db + 48) / 48));
    return Math.round(fraction * segments);
}

export function formatTime(seconds: number): { main: string; hundredths: string } {
    const clamped = Math.max(0, seconds);
    const m = Math.floor(clamped / 60);
    const s = Math.floor(clamped % 60);
    const h = Math.floor((clamped % 1) * 100);
    return { main: `${m}:${String(s).padStart(2, '0')}`, hundredths: `.${String(h).padStart(2, '0')}` };
}

/* "LOOP 0:02.1 — 0:08.4" caption values. */
export function formatLoopLabel(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
}
