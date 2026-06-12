import { midiNoteName } from '~/utils/midi';

/* useMidiInput - the Web MIDI layer of live-input mode.

   Wraps navigator.requestMIDIAccess into: a connect() gated on a user
   gesture (the browser shows a permission prompt), hot-plug device
   tracking via statechange, and a single onNote callback fed from every
   connected input. Synthesis lives elsewhere (useLiveSynth) - this
   composable only translates the wire format.

   The lastEvent readout exists for the MIDI monitor in the UI: with a
   keyboard whose keys half-work, seeing "which key registered, how hard"
   is the difference between debugging hardware and debugging code. */

export interface MidiNoteEvent {
    on: boolean;
    note: number;
    /** 0..127 */
    velocity: number;
    device: string;
}

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

export function useMidiInput() {
    const supported = ref(false);
    const connected = ref(false);
    const deviceNames = ref<string[]>([]);
    const lastEvent = ref<(MidiNoteEvent & { label: string }) | null>(null);

    let access: MIDIAccess | null = null;
    let onNoteCallback: ((e: MidiNoteEvent) => void) | null = null;

    const handleMessage = (deviceName: string) => (msg: MIDIMessageEvent) => {
        const [status = 0, note = 0, velocity = 0] = msg.data ?? [];
        const command = status & 0xf0;
        // Note-on with velocity 0 is the wire's idiom for note-off
        const isOn = command === NOTE_ON && velocity > 0;
        const isOff = command === NOTE_OFF || (command === NOTE_ON && velocity === 0);
        if (!isOn && !isOff) return; // CC / pitch-bend / clock: ignored for now

        const event: MidiNoteEvent = { on: isOn, note, velocity, device: deviceName };
        lastEvent.value = { ...event, label: midiNoteName(note) };
        onNoteCallback?.(event);
    };

    const refreshDevices = () => {
        if (!access) return;
        const names: string[] = [];
        access.inputs.forEach((input) => {
            names.push(input.name ?? 'Unnamed device');
            // Idempotent: reassigning onmidimessage replaces, never stacks
            input.onmidimessage = handleMessage(input.name ?? 'Unnamed device');
        });
        deviceNames.value = names;
        connected.value = names.length > 0;
    };

    /** Call from a user gesture; resolves false if MIDI is unavailable
     *  or the user declines the permission prompt. */
    const connect = async (): Promise<boolean> => {
        supported.value = 'requestMIDIAccess' in navigator;
        if (!supported.value) return false;
        try {
            access = await navigator.requestMIDIAccess();
        } catch {
            return false;
        }
        access.onstatechange = refreshDevices; // hot-plug both directions
        refreshDevices();
        return true;
    };

    const onNote = (cb: (e: MidiNoteEvent) => void) => {
        onNoteCallback = cb;
    };

    const disconnect = () => {
        access?.inputs.forEach((input) => {
            input.onmidimessage = null;
        });
        if (access) access.onstatechange = null;
        access = null;
        connected.value = false;
        deviceNames.value = [];
    };

    return { supported, connected, deviceNames, lastEvent, connect, onNote, disconnect };
}
