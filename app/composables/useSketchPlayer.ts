/* Web Audio transport for the sketch workspace.

   Owns one AudioContext (created on the first play gesture, per autoplay
   policy) and one source node at a time. Pause is ctx.suspend() - that
   freezes currentTime, which keeps the playhead arithmetic trivial; the
   loop cycling itself is loopedPlayhead() so it stays unit-tested. The
   meter taps a channel splitter into two analysers (L/R rows). */

import { byteRms, litSegments, loopedPlayhead, waveformPeaks, type LoopRegion } from '~/utils/sketch/audio';

export type PlayState = 'stopped' | 'playing' | 'paused';

const METER_BARS = 64;

export function useSketchPlayer() {
    const playState = ref<PlayState>('stopped');
    const playhead = ref(0);
    const duration = ref(0);
    const peaks = ref<number[]>(Array.from({ length: METER_BARS }, () => 0));
    const meter = ref<{ left: number; right: number; db: number | null }>({ left: 0, right: 0, db: null });
    const sampleRate = ref(44100);
    const channelCount = ref(0);
    const loop = reactive<LoopRegion>({ start: 0, end: 0, enabled: false });

    let ctx: AudioContext | undefined;
    let buffer: AudioBuffer | undefined;
    let source: AudioBufferSourceNode | undefined;
    let analysers: AnalyserNode[] = [];
    let raf = 0;
    /* Where the current source started: playhead = looped(offset + elapsed). */
    let startOffset = 0;
    let startedAt = 0;
    let stopping = false;

    function ensureContext(): AudioContext {
        ctx ??= new AudioContext();
        sampleRate.value = ctx.sampleRate;
        return ctx;
    }

    /* The true device rate, for callers that generate audio BEFORE
       load() - creating the context here keeps generation and playback
       at one rate. Call from a user gesture (autoplay policy). */
    function ensureSampleRate(): number {
        return ensureContext().sampleRate;
    }

    function load(channels: Float32Array[]) {
        stop();
        const audioCtx = ensureContext();
        channelCount.value = channels.length;
        buffer = audioCtx.createBuffer(channels.length, channels[0]!.length, audioCtx.sampleRate);
        channels.forEach((data, i) => buffer!.copyToChannel(data, i));
        duration.value = buffer.duration;
        peaks.value = waveformPeaks(channels[0]!, METER_BARS);
        loop.start = 0;
        loop.end = buffer.duration;
        loop.enabled = false;
        playhead.value = 0;
    }

    function tick() {
        if (!ctx || playState.value !== 'playing') return;
        playhead.value = loopedPlayhead(startOffset, ctx.currentTime - startedAt, duration.value, loop);
        const rms = analysers.map((a) => {
            const data = new Uint8Array(a.fftSize);
            a.getByteTimeDomainData(data);
            return byteRms(data);
        });
        const rmsMax = Math.max(rms[0] ?? 0, rms[1] ?? 0);
        meter.value = {
            left: litSegments(rms[0] ?? 0),
            right: litSegments(rms[1] ?? rms[0] ?? 0),
            db: rmsMax > 0 ? 20 * Math.log10(rmsMax) : null,
        };
        raf = requestAnimationFrame(tick);
    }

    function startSource(offset: number) {
        if (!ctx || !buffer) return;
        source?.disconnect();
        source = ctx.createBufferSource();
        source.buffer = buffer;
        applyLoop();
        const splitter = ctx.createChannelSplitter(buffer.numberOfChannels);
        analysers = Array.from({ length: buffer.numberOfChannels }, (_, i) => {
            const analyser = ctx!.createAnalyser();
            analyser.fftSize = 1024;
            splitter.connect(analyser, i);
            return analyser;
        });
        source.connect(splitter);
        source.connect(ctx.destination);
        source.onended = () => {
            if (stopping) return;
            playState.value = 'stopped';
            playhead.value = 0;
            meter.value = { left: 0, right: 0, db: null };
            cancelAnimationFrame(raf);
        };
        startOffset = offset;
        startedAt = ctx.currentTime;
        source.start(0, offset);
    }

    function applyLoop() {
        if (!source) return;
        source.loop = loop.enabled;
        source.loopStart = loop.start;
        source.loopEnd = loop.end;
    }
    watch(loop, () => {
        applyLoop();
    });

    async function play() {
        if (!buffer) return;
        const audioCtx = ensureContext();
        if (playState.value === 'paused') {
            await audioCtx.resume();
        } else {
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            startSource(playhead.value >= duration.value ? 0 : playhead.value);
        }
        playState.value = 'playing';
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
    }

    async function pause() {
        if (playState.value !== 'playing' || !ctx) return;
        await ctx.suspend();
        playState.value = 'paused';
        cancelAnimationFrame(raf);
    }

    function stop() {
        stopping = true;
        try {
            source?.stop();
        } catch {
            // never started - nothing to stop
        }
        source = undefined;
        stopping = false;
        cancelAnimationFrame(raf);
        playState.value = 'stopped';
        playhead.value = 0;
        meter.value = { left: 0, right: 0, db: null };
        if (ctx?.state === 'suspended') void ctx.resume();
    }

    async function seek(seconds: number) {
        const target = Math.min(Math.max(0, seconds), duration.value);
        if (playState.value === 'playing') {
            stopping = true;
            try {
                source?.stop();
            } catch {
                // already ended
            }
            stopping = false;
            startSource(target);
        }
        playhead.value = target;
    }

    function dispose() {
        stop();
        void ctx?.close();
        ctx = undefined;
        buffer = undefined;
    }

    return {
        playState,
        playhead,
        duration,
        peaks,
        meter,
        sampleRate,
        channelCount,
        loop,
        ensureSampleRate,
        load,
        play,
        pause,
        stop,
        seek,
        dispose,
    };
}
