interface AudioState {
    ctx: AudioContext | null;
    buffer: AudioBuffer | null;
    source: AudioBufferSourceNode | null;
    wavStartedAt: number;
    wavOffset: number;
    started: boolean;
}

interface FileInput extends File {
    arrayBuffer(): Promise<ArrayBuffer>;
}

export function useWavPlayer() {
    // Handle server-side rendering
    if (import.meta.server) {
        const noopAsync = async () => {};
        return {
            audio: reactive<AudioState>({
                ctx: null,
                buffer: null,
                source: null,
                wavStartedAt: 0,
                wavOffset: 0,
                started: false,
            }),
            wavLoaded: ref(false),
            loadWavFile: noopAsync,
            playWav: () => {},
            stopWavOnly: () => {},
            stopAllAudio: () => {},
            startAudio: noopAsync,
            getPlaybackTimeSeconds: () => 0,
        };
    }

    const audio = reactive<AudioState>({
        ctx: null,
        buffer: null,
        source: null,
        wavStartedAt: 0,
        wavOffset: 0,
        started: false,
    });

    const wavLoaded = ref(false);

    const loadWavFile = async (file: FileInput) => {
        console.log('Loading WAV file:', file.name);
        const ctx = audio.ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
        audio.ctx = ctx;

        const arrayBuf = await file.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        console.log('WAV file decoded:', decoded);
        audio.buffer = decoded;

        wavLoaded.value = true;
    };

    const playWav = (offsetSeconds = 0) => {
        if (!audio.ctx || !audio.buffer) return;
        stopWavOnly();

        console.log('Starting WAV playback at offset', offsetSeconds);

        const src = audio.ctx.createBufferSource();
        src.buffer = audio.buffer;

        console.log('src.buffer =', src.buffer);

        const gain = audio.ctx.createGain();
        const gainLevel = 0.85; // Reduce volume to 85% to avoid clipping
        gain.gain.value = gainLevel;
        src.connect(gain).connect(audio.ctx.destination);

        audio.source = src;
        audio.wavStartedAt = audio.ctx.currentTime;
        audio.wavOffset = offsetSeconds;

        src.start(0, offsetSeconds);
        src.onended = () => {
            // leave the corridor in place; just stop advancing playback mapping
            audio.source = null;
        };
    };

    const stopWavOnly = () => {
        if (audio.source) {
            try {
                // store current offset so we can resume if desired
                const played = audio.ctx!.currentTime - audio.wavStartedAt;
                audio.wavOffset = clamp(audio.wavOffset + played, 0, audio.buffer ? audio.buffer.duration : Infinity);
                audio.source.stop();
            } catch (_) { }
            audio.source = null;
        }
    };

    const stopAllAudio = () => {
        stopWavOnly();
        audio.started = false;
    };

    const startAudio = async () => {
        console.log('Starting audio playback');
        if (audio.ctx) {
            await audio.ctx.resume();
        }
        audio.started = true;
        playWav(0);
    };

    const getPlaybackTimeSeconds = () => {
        if (!audio.ctx) return 0;
        const played = audio.source ? (audio.ctx.currentTime - audio.wavStartedAt) : 0;
        return clamp(audio.wavOffset + played, 0, audio.buffer ? audio.buffer.duration : Infinity);
    };

    return {
        audio,
        wavLoaded,
        loadWavFile,
        playWav,
        stopWavOnly,
        stopAllAudio,
        startAudio,
        getPlaybackTimeSeconds,
    };
}
