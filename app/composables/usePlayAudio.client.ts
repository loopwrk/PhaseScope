import * as Tone from "tone";
import { durations } from "~/constants/music";

const loops: Tone.Loop[] = [];
const synths: (Tone.Synth | Tone.FMSynth | Tone.AMSynth)[] = [];
const parts: Tone.Part[] = [];

let synth: Tone.Synth | null = null;
const timeContext = ref<number>(0);
let timeInterval: number | null = null;
const isCurrentlyPlaying = ref<boolean>(false);
const currentPlayingNote = ref<string | null>(null);
const currentPlayingIndex = ref<number | null>(null);

// Track which PlayPauseButton instance started the current playback
const activePlayButtonId = ref<string | null>(null);

// Analyser extracts FFT or Waveform data from the incoming signal (https://tonejs.github.io/docs/14.7.38/Analyser)
let analyser: Tone.Analyser | null = null;
const waveform = shallowRef<Float32Array | null>(null);
let animationFrameId: number | null = null;

const updateWaveform = () => {
  if (!analyser) return;
  const waveFormValues = analyser.getValue() as Float32Array;
  waveform.value = new Float32Array(waveFormValues);
  if (isCurrentlyPlaying.value) {
    animationFrameId = requestAnimationFrame(updateWaveform);
  }
};

export function usePlayAudio() {
  // Handle server-side rendering
  if (import.meta.server) {
    const noopAsync = async () => {};
    return {
      isCurrentlyPlaying: ref(false),
      activePlayButtonId: ref<string | null>(null),
      singleNote: noopAsync,
      multipleNotes: noopAsync,
      startScheduled: noopAsync,
      stopScheduled: () => {},
      waveform: shallowRef<Float32Array | null>(null),
      timeContext: ref(0),
      currentPlayingNote: ref<string | null>(null),
      currentPlayingIndex: ref<number | null>(null),
      startTimeContext: () => {},
      stopTimeContext: () => {},
    };
  }

  const init = async () => {
    await Tone.start();

    if (!synth) {
      synth = new Tone.Synth({
        oscillator: { type: "sine" },
      }).toDestination();
    }

    if (!analyser) {
      analyser = new Tone.Analyser("waveform", 1024);
      synth.connect(analyser);
      waveform.value = new Float32Array(1024);
    }
  };

  const singleNote = async (note: string) => {
    await init();
    const now = Tone.now();
    isCurrentlyPlaying.value = true;
    synth?.triggerAttack(note, now);
    synth?.triggerRelease(now + 1);

    // Stop visualization after note ends
    setTimeout(() => {
      isCurrentlyPlaying.value = false;
    }, 1000);
  };

  const multipleNotes = async (
    noteSequence: Array<string> = ["C4", "C4", "G4", "G4", "A4", "A4", "G4"],
    restTime: number = 0.5,
  ) => {
    await init();

    parts.forEach((part) => part.dispose());
    parts.length = 0;

    const events = noteSequence.map((note, index) => [
      index * restTime,
      { note, index },
    ]);

    // Create a Part for the note sequence
    const part = new Tone.Part((time, value) => {
      const { note, index } = value as { note: string; index: number };

      synth?.triggerAttackRelease(note, durations.eighth, time);

      Tone.getDraw().schedule(() => {
        currentPlayingNote.value = note;
        currentPlayingIndex.value = index;
      }, time);

      Tone.getDraw().schedule(
        () => {
          currentPlayingNote.value = null;
          currentPlayingIndex.value = null;
        },
        time + Tone.Time(durations.eighth).toSeconds(),
      );
    }, events);

    parts.push(part);

    part.start(0);
    part.stop(noteSequence.length * restTime);

    Tone.getTransport().start();
    isCurrentlyPlaying.value = true;

    // Stop transport and cleanup after sequence completes
    setTimeout(
      () => {
        Tone.getTransport().stop();
        part.dispose();
        isCurrentlyPlaying.value = false;
        const index = parts.indexOf(part);
        if (index > -1) parts.splice(index, 1);
      },
      (noteSequence.length * restTime + 1) * 1000,
    );
  };

  const startScheduled = async () => {
    await init();

    const synthA = new Tone.FMSynth().toDestination();
    const synthB = new Tone.AMSynth().toDestination();
    synths.push(synthA, synthB);

    //play a note every quarter-note
    const loopA = new Tone.Loop((time) => {
      synthA.triggerAttackRelease("C2", durations.eighth, time);
    }, durations.quarter).start(0);

    const loopB = new Tone.Loop((time) => {
      synthB.triggerAttackRelease("C4", durations.eighth, time);
    }, durations.quarter).start(durations.eighth);

    loops.push(loopA, loopB);

    // all loops start when the Transport is started
    Tone.getTransport().start();
    isCurrentlyPlaying.value = true;
    // ramp up to 800 bpm over 10 seconds
    Tone.getTransport().bpm.rampTo(800, 10);
  };

  const stopScheduled = () => {
    Tone.getTransport().stop();
    loops.forEach((loop) => loop.dispose());
    loops.length = 0;
    synths.forEach((s) => s.dispose());
    synths.length = 0;
    isCurrentlyPlaying.value = false;
  };

  const startTimeContext = () => {
    if (timeInterval) return; // already running

    timeInterval = setInterval(() => {
      timeContext.value = Tone.now();
    }, 100);
  };

  const stopTimeContext = () => {
    if (timeInterval) {
      clearInterval(timeInterval);
      timeInterval = null;
    }
  };

  watch(isCurrentlyPlaying, (playing) => {
    if (playing) {
      updateWaveform();
    } else {
      // Reset active button when playback stops
      activePlayButtonId.value = null;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        waveform.value = new Float32Array(1024);
      }
    }
  });

  return {
    isCurrentlyPlaying,
    activePlayButtonId,
    singleNote,
    multipleNotes,
    startScheduled,
    stopScheduled,
    waveform,
    timeContext,
    currentPlayingNote,
    currentPlayingIndex,
    startTimeContext,
    stopTimeContext,
  };
}
