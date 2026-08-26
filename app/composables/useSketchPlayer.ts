/* Web Audio transport for the sketch workspace.

   Owns one AudioContext (created on the first play gesture, per autoplay
   policy) and one source node at a time. Pause is ctx.suspend() - that
   freezes currentTime, which keeps the playhead arithmetic trivial; the
   loop cycling itself is loopedPlayhead() so it stays unit-tested. The
   meter taps a channel splitter into two analysers (L/R rows).

   Two kinds of source, sharing everything downstream of the splitter:

     buffer - audio() generated a Float32Array, played by a
              AudioBufferSourceNode. The playhead is arithmetic on
              ctx.currentTime; params are baked in and cannot change.
     live   - process() synthesises on the audio thread in an
              AudioWorkletNode. Params are posted to it and take effect
              within a block, so they can change while it plays. The
              playhead is reported back by the processor rather than
              computed, because only the processor knows where it is. */

import { byteRms, litSegments, loopedPlayhead, waveformPeaks, type LoopRegion } from '~/utils/sketch/audio';
import { instantiateLive, renderLive } from '~/utils/sketch/live-source';
import type { LiveVoice, SketchParams } from '~/utils/sketch/runner';

export type PlayState = 'stopped' | 'playing' | 'paused';

const METER_BARS = 64;

export function useSketchPlayer() {
    const playState = ref<PlayState>('stopped');
    const playhead = ref(0);
    const duration = ref(0);
    const peaks = ref<number[]>(Array.from({ length: METER_BARS }, () => 0));
    const meter = ref<{ left: number; right: number; db: number | null }>({ left: 0, right: 0, db: null });
    const sampleRate = ref(44100);
    /* A live voice that throws reports it here - the audio thread cannot
       surface an error the way a failed run() can. */
    const liveError = ref<string | null>(null);
    const channelCount = ref(0);
    const loop = reactive<LoopRegion>({ start: 0, end: 0, enabled: false });

    /* Live sketches have no buffer to measure, so the waveform behind the
       scrub bar is rendered offline instead - see refreshLivePeaks(). */
    const isLive = ref(false);

    let ctx: AudioContext | undefined;
    let buffer: AudioBuffer | undefined;
    let source: AudioBufferSourceNode | undefined;
    let voice: AudioWorkletNode | undefined;
    let liveVoice: LiveVoice | undefined;
    let liveParams: SketchParams = {};
    let workletReady: Promise<void> | undefined;
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
        isLive.value = false;
        liveVoice = undefined;
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
        /* A live voice reports its own position - only it knows where it
           is, and ctx.currentTime says nothing about a seek it performed. */
        if (!isLive.value) {
            playhead.value = loopedPlayhead(startOffset, ctx.currentTime - startedAt, duration.value, loop);
        }
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

    /* Splitter -> one analyser per channel -> the meter rows, plus a
       straight run to the destination. Shared by both source kinds. */
    function connectMeter(node: AudioNode, channels: number) {
        const audioCtx = ctx!;
        const splitter = audioCtx.createChannelSplitter(channels);
        analysers = Array.from({ length: channels }, (_, i) => {
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 1024;
            splitter.connect(analyser, i);
            return analyser;
        });
        node.connect(splitter);
        node.connect(audioCtx.destination);
    }

    function startSource(offset: number) {
        if (!ctx || !buffer) return;
        source?.disconnect();
        source = ctx.createBufferSource();
        source.buffer = buffer;
        applyLoop();
        connectMeter(source, buffer.numberOfChannels);
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

    /* One addModule per context; the processor is generic and compiles
       whichever sketch it is handed. */
    function ensureWorklet(): Promise<void> {
        const audioCtx = ensureContext();
        workletReady ??= audioCtx.audioWorklet.addModule('/sketch-live-processor.js');
        return workletReady;
    }

    async function loadLive(next: LiveVoice, params: SketchParams) {
        stop();
        ensureContext();
        await ensureWorklet();
        liveVoice = next;
        liveParams = { ...params };
        isLive.value = true;
        buffer = undefined;
        channelCount.value = 1;
        duration.value = next.seconds;
        loop.start = 0;
        loop.end = next.seconds;
        loop.enabled = false;
        playhead.value = 0;
        refreshLivePeaks();
    }

    function startVoice(offset: number) {
        if (!ctx || !liveVoice) return;
        voice?.disconnect();
        voice = new AudioWorkletNode(ctx, 'sketch-live', {
            numberOfInputs: 0,
            outputChannelCount: [2],
            processorOptions: { code: liveVoice.code, seconds: liveVoice.seconds, params: liveParams },
        });
        voice.port.onmessage = (event: MessageEvent) => receiveFromVoice(event.data);
        connectMeter(voice, 2);
        applyLoop();
        if (offset > 0) voice.port.postMessage({ type: 'seek', seconds: offset });
    }

    function receiveFromVoice(message: { type: string; seconds?: number; message?: string }) {
        if (message.type === 'position') {
            playhead.value = message.seconds ?? 0;
        } else if (message.type === 'ended') {
            playState.value = 'stopped';
            playhead.value = 0;
            meter.value = { left: 0, right: 0, db: null };
            cancelAnimationFrame(raf);
        } else if (message.type === 'error') {
            liveError.value = message.message ?? 'live voice failed';
            stop();
        }
    }

    /* Live params reach the audio thread by message and take effect on the
       next block. The scrub-bar waveform has to be re-rendered offline to
       match, but only once the value settles - not on every drag step. */
    let peaksTimer: ReturnType<typeof setTimeout> | undefined;
    function setLiveParams(next: SketchParams) {
        if (!isLive.value) return;
        liveParams = { ...next };
        voice?.port.postMessage({ type: 'params', params: liveParams });
        clearTimeout(peaksTimer);
        peaksTimer = setTimeout(refreshLivePeaks, 200);
    }

    function refreshLivePeaks() {
        if (!liveVoice) return;
        try {
            const offline = instantiateLive(liveVoice.code);
            const rendered = renderLive(offline, {
                sampleRate: sampleRate.value,
                params: liveParams,
                seconds: liveVoice.seconds,
            });
            peaks.value = waveformPeaks(rendered, METER_BARS);
        } catch {
            /* Preview only. A voice that cannot run will say so through the
               worklet when it is actually played. */
        }
    }

    function applyLoop() {
        if (isLive.value) {
            voice?.port.postMessage({ type: 'loop', enabled: loop.enabled, start: loop.start, end: loop.end });
            return;
        }
        if (!source) return;
        source.loop = loop.enabled;
        source.loopStart = loop.start;
        source.loopEnd = loop.end;
    }
    watch(loop, () => {
        applyLoop();
    });

    async function play() {
        if (!buffer && !liveVoice) return;
        const audioCtx = ensureContext();
        if (playState.value === 'paused') {
            await audioCtx.resume();
        } else {
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            const from = playhead.value >= duration.value ? 0 : playhead.value;
            liveError.value = null;
            if (isLive.value) startVoice(from);
            else startSource(from);
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
        /* Dropping the node ends the voice; the next play builds a fresh
           one, which is also how its state gets cleared. */
        if (voice) {
            voice.port.onmessage = null;
            voice.disconnect();
            voice = undefined;
        }
        stopping = false;
        cancelAnimationFrame(raf);
        playState.value = 'stopped';
        playhead.value = 0;
        meter.value = { left: 0, right: 0, db: null };
        if (ctx?.state === 'suspended') void ctx.resume();
    }

    async function seek(seconds: number) {
        const target = Math.min(Math.max(0, seconds), duration.value);
        if (isLive.value) {
            /* The processor re-runs the voice from the start up to here, so
               its phase and any filter state belong to the new position
               rather than the old one. */
            voice?.port.postMessage({ type: 'seek', seconds: target });
            playhead.value = target;
            return;
        }
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
        clearTimeout(peaksTimer);
        void ctx?.close();
        ctx = undefined;
        buffer = undefined;
        liveVoice = undefined;
        workletReady = undefined;
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
        isLive,
        liveError,
        ensureSampleRate,
        load,
        loadLive,
        setLiveParams,
        play,
        pause,
        stop,
        seek,
        dispose,
    };
}
