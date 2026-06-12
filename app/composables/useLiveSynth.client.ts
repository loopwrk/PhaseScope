import { midiNoteToHz, pitchToPan, velocityToGain } from '~/utils/midi';
import { LIVE_VOICES, type LiveVoiceId } from '~/utils/liveVoices';
import type { GoniometerSource } from '~/components/layout/Goniometer.vue';

/* useLiveSynth - the sound engine of live-input mode.

   A hand-rolled Web Audio polysynth (two detuned saws -> lowpass -> ADSR
   -> pitch-panned stereo) rather than a synth library: the deciding
   factor is the CAPTURE TAP. The master bus feeds both the speakers and
   an AudioWorklet that mirrors the final stereo mix into a ring buffer,
   so the goniometer / scope / corridor draw exactly what you hear -
   library-managed audio graphs make that tap awkward, raw nodes make it
   two connects. The voice interface is deliberately small (noteOn /
   noteOff / allNotesOff) so a fancier instrument can swap in behind it.

   The ring buffer speaks the engine's GoniometerSource dialect
   ({ch0, ch1, index, sr}): liveSource() is a drop-in replacement for the
   track-playback source getter. Silence keeps streaming zeros, so an
   idle synth reads as a resting dot, not a frozen figure. */

const RING_SECONDS = 30;
const VOICE_RELEASE = 0.25;

/* Inline AudioWorklet: copies each 128-frame quantum of the master mix
   to the main thread. ~375 messages/sec of 1KB - negligible. */
const CAPTURE_WORKLET = `
class PsCapture extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (input && input[0]) {
            this.port.postMessage([input[0].slice(0), (input[1] || input[0]).slice(0)]);
        }
        return true;
    }
}
registerProcessor('ps-capture', PsCapture);
`;

interface Voice {
    oscA: OscillatorNode;
    oscB: OscillatorNode | null;
    filter: BiquadFilterNode | null;
    env: GainNode;
    pan: StereoPannerNode;
}

export function useLiveSynth() {
    const enabled = ref(false);
    const activeVoiceCount = ref(0);

    // The brush: which preset new notes are built with (held notes keep
    // the timbre they were struck with - a natural crossfade)
    const voicePreset = usePersistedState<LiveVoiceId>('scope:live-voice', () => 'warm');

    let ctx: AudioContext | null = null;
    let master: GainNode | null = null;
    let capture: AudioWorkletNode | null = null;
    const voices = new Map<number, Voice>();

    let ch0: Float32Array | null = null;
    let ch1: Float32Array | null = null;
    let ringLength = 0;
    let writeTotal = 0;

    const writeChunk = ([left, right]: [Float32Array, Float32Array]) => {
        if (!ch0 || !ch1) return;
        for (let i = 0; i < left.length; i++) {
            const w = (writeTotal + i) % ringLength;
            ch0[w] = left[i] ?? 0;
            ch1[w] = right[i] ?? 0;
        }
        writeTotal += left.length;
    };

    /** Call from a user gesture (live-mode button). ringQuantum (the
     *  engine's hopSize) rounds the ring up to a whole number of hops, so
     *  a ring slot's audio always lives at slot * hopSize - the live
     *  corridor build relies on that coincidence. */
    const enable = async (opts: { ringQuantum?: number } = {}): Promise<boolean> => {
        if (enabled.value) return true;
        try {
            ctx = ctx ?? new AudioContext();
            await ctx.resume();
            if (!master) {
                const blobUrl = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: 'text/javascript' }));
                await ctx.audioWorklet.addModule(blobUrl);
                URL.revokeObjectURL(blobUrl);

                const quantum = Math.max(1, opts.ringQuantum ?? 1);
                ringLength = Math.ceil((RING_SECONDS * ctx.sampleRate) / quantum) * quantum;
                ch0 = new Float32Array(ringLength);
                ch1 = new Float32Array(ringLength);

                master = ctx.createGain();
                master.gain.value = 0.85; // same clipping headroom as the track player
                capture = new AudioWorkletNode(ctx, 'ps-capture', {
                    numberOfOutputs: 0,
                    channelCount: 2,
                    channelCountMode: 'explicit',
                });
                capture.port.onmessage = (e) => writeChunk(e.data);
                master.connect(ctx.destination);
                master.connect(capture);
            }
            enabled.value = true;
            return true;
        } catch {
            return false;
        }
    };

    const noteOn = (note: number, velocity: number) => {
        if (!ctx || !master || !enabled.value) return;
        noteOff(note, true); // retrigger steals the old voice instantly

        const def = LIVE_VOICES[voicePreset.value] ?? LIVE_VOICES.warm;
        const hz = midiNoteToHz(note);
        const peak = velocityToGain(velocity) * def.gain;
        const t = ctx.currentTime;

        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(peak, t + 0.01); // attack
        env.gain.exponentialRampToValueAtTime(Math.max(peak * 0.72, 1e-4), t + 0.13); // decay to sustain

        const pan = ctx.createStereoPanner();
        pan.pan.value = pitchToPan(note);

        // The oscillators feed the filter when the preset wants one,
        // otherwise straight into the envelope
        let input: AudioNode = env;
        let filter: BiquadFilterNode | null = null;
        if (def.filterMult > 0) {
            filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = Math.min(hz * def.filterMult, 9000);
            filter.Q.value = 0.8;
            filter.connect(env);
            input = filter;
        }

        const oscA = ctx.createOscillator();
        oscA.type = def.wave;
        oscA.frequency.value = hz;
        oscA.detune.value = -def.detune / 2;
        oscA.connect(input);
        oscA.start(t);

        let oscB: OscillatorNode | null = null;
        if (def.bRatio > 0) {
            oscB = ctx.createOscillator();
            oscB.type = def.wave;
            oscB.frequency.value = hz * def.bRatio;
            oscB.detune.value = def.detune / 2;
            const gB = ctx.createGain();
            gB.gain.value = def.bLevel;
            oscB.connect(gB);
            gB.connect(input);
            oscB.start(t);
        }

        env.connect(pan).connect(master);

        voices.set(note, { oscA, oscB, filter, env, pan });
        activeVoiceCount.value = voices.size;
    };

    const noteOff = (note: number, instant = false) => {
        if (!ctx) return;
        const voice = voices.get(note);
        if (!voice) return;
        voices.delete(note);
        activeVoiceCount.value = voices.size;

        const t = ctx.currentTime;
        const release = instant ? 0.005 : VOICE_RELEASE;
        voice.env.gain.cancelScheduledValues(t);
        voice.env.gain.setValueAtTime(voice.env.gain.value, t);
        voice.env.gain.exponentialRampToValueAtTime(1e-4, t + release);
        voice.oscA.stop(t + release + 0.01);
        voice.oscB?.stop(t + release + 0.01);
        // GC: once the voice ends, unhook the whole chain
        voice.oscA.onended = () => {
            voice.pan.disconnect();
        };
    };

    const allNotesOff = () => {
        [...voices.keys()].forEach((note) => noteOff(note));
    };

    /** Drop-in for the track-playback source getter while live. */
    const liveSource = (): (GoniometerSource & { sr: number }) | null => {
        if (!enabled.value || !ch0 || !ch1 || !ctx) return null;
        return { ch0, ch1, index: writeTotal % ringLength, sr: ctx.sampleRate };
    };

    /** Total samples ever written - the live corridor's build clock. */
    const samplesWritten = () => writeTotal;

    /** Blank page: zero the ring and restart the sample clock, so a new
     *  live session (or a new window size) never ghosts the previous one. */
    const resetRing = () => {
        ch0?.fill(0);
        ch1?.fill(0);
        writeTotal = 0;
    };

    /** The raw ring, for the engine to adopt as its live channel data. */
    const ringInfo = () => (ch0 && ch1 && ctx ? { ch0, ch1, sr: ctx.sampleRate, ringLength } : null);

    const disable = () => {
        allNotesOff();
        enabled.value = false;
    };

    const dispose = async () => {
        disable();
        capture?.port.close();
        if (ctx) {
            await ctx.close();
            ctx = null;
        }
        master = null;
        capture = null;
        ch0 = null;
        ch1 = null;
    };

    return {
        enabled,
        activeVoiceCount,
        enable,
        disable,
        dispose,
        noteOn,
        noteOff,
        allNotesOff,
        liveSource,
        samplesWritten,
        resetRing,
        ringInfo,
        voice: voicePreset,
    };
}
