interface AudioState {
  ctx: AudioContext | null;
  buffer: AudioBuffer | null;
  source: AudioBufferSourceNode | null;
  wavStartedAt: number;
  wavOffset: number;
  started: boolean;
}

export function useWavPlayer() {
  // Handle server-side renderinge
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
      pauseAudio: () => {},
      resumeAudio: noopAsync,
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

  const loadWavFile = async (file: File) => {
    if (import.meta.dev) console.log("Loading WAV file:", file.name);

    audio.wavOffset = 0;
    audio.wavStartedAt = 0;
    audio.started = false;

    const ctx =
      audio.ctx ||
      new (window.AudioContext || (window as any).webkitAudioContext)();
    audio.ctx = ctx;

    const arrayBuf = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    if (import.meta.dev) console.log("WAV file decoded:", decoded);
    audio.buffer = decoded;

    wavLoaded.value = true;
  };

  const playWav = (offsetSeconds = 0) => {
    if (!audio.ctx || !audio.buffer) return;
    stopWavOnly();

    if (import.meta.dev)
      console.log("Starting WAV playback at offset", offsetSeconds);

    const src = audio.ctx.createBufferSource();
    src.buffer = audio.buffer;

    if (import.meta.dev) console.log("src.buffer =", src.buffer);

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
        audio.wavOffset = clamp(
          audio.wavOffset + played,
          0,
          audio.buffer ? audio.buffer.duration : Infinity,
        );
        audio.source.stop();
      } catch (error) {
        if (import.meta.dev) console.warn("Failed to stop audio source:", error);
      }
      audio.source = null;
    }
  };

  const stopAllAudio = () => {
    stopWavOnly();
    audio.started = false;
    audio.wavOffset = 0;
  };

  const pauseAudio = () => {
    if (!audio.source) return;

    if (import.meta.dev)
      console.log("Pausing audio at offset", audio.wavOffset);
    stopWavOnly();
  };

  const resumeAudio = async () => {
    if (import.meta.dev)
      console.log("Resuming audio from offset", audio.wavOffset);
    if (audio.ctx) {
      await audio.ctx.resume();
    }
    audio.started = true;
    playWav(audio.wavOffset);
  };

  const startAudio = async () => {
    if (import.meta.dev) console.log("Starting audio playback from beginning");
    if (audio.ctx) {
      await audio.ctx.resume();
    }
    audio.started = true;
    audio.wavOffset = 0;
    playWav(0);
  };

  const getPlaybackTimeSeconds = () => {
    if (!audio.ctx) return 0;
    const played = audio.source
      ? audio.ctx.currentTime - audio.wavStartedAt
      : 0;
    return clamp(
      audio.wavOffset + played,
      0,
      audio.buffer ? audio.buffer.duration : Infinity,
    );
  };

  return {
    audio,
    wavLoaded,
    loadWavFile,
    playWav,
    stopWavOnly,
    stopAllAudio,
    pauseAudio,
    resumeAudio,
    startAudio,
    getPlaybackTimeSeconds,
  };
}
