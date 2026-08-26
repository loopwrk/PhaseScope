/* Live sketch voice, running on the audio thread.

   The sketch's own code arrives as a string in processorOptions and is
   compiled once here; calling the factory again gives a fresh set of
   module-level variables, which is how a seek rewinds a voice's state
   without recompiling anything.

   Parameters arrive by message and are glided towards rather than
   snapped to - a step change in amplitude between blocks is a click, and
   a run of them while dragging is a zipper. Everything else (position,
   ending, errors) goes back to the main thread the same way.

   Kept in public/ as a plain script: it is loaded by URL through
   audioWorklet.addModule, not bundled. */

const SMOOTHING = 0.25; // per block, ~10ms to settle at 128 frames
const SNAP_BELOW = 1e-6;
const POSITION_EVERY_BLOCKS = 8; // ~21ms at 48kHz

class SketchLiveProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const opts = options.processorOptions || {};
        this.totalFrames = Math.max(1, Math.round((opts.seconds || 2) * sampleRate));
        this.loop = { enabled: false, startFrame: 0, endFrame: this.totalFrames };
        this.frame = 0;
        this.blocks = 0;
        this.failed = false;
        this.finished = false;

        this.current = { ...(opts.params || {}) };
        this.target = { ...this.current };

        this.scratch = new Float32Array(128);
        this.compile(opts.code || '');
        this.instantiate();

        this.port.onmessage = (event) => this.receive(event.data);
    }

    compile(code) {
        try {
            this.factory = new Function(
                `${code}
                return { process: typeof process === 'function' ? process : undefined };`
            );
        } catch (error) {
            this.fail(`could not compile: ${error.message}`);
        }
    }

    /* A fresh set of the sketch's own variables - a new phase accumulator,
       a cleared filter, whatever it keeps. */
    instantiate() {
        if (!this.factory) return;
        try {
            const built = this.factory();
            this.render = typeof built.process === 'function' ? built.process : null;
            if (!this.render) this.fail('live sketches must export process(out, { sampleRate, params })');
        } catch (error) {
            this.fail(error.message);
        }
    }

    fail(message) {
        if (this.failed) return;
        this.failed = true;
        this.render = null;
        this.port.postMessage({ type: 'error', message });
    }

    receive(message) {
        if (message.type === 'params') {
            this.target = { ...message.params };
            /* A key that was not there before has no value to glide from. */
            for (const name of Object.keys(this.target)) {
                if (!(name in this.current)) this.current[name] = this.target[name];
            }
        } else if (message.type === 'loop') {
            this.loop.enabled = Boolean(message.enabled);
            this.loop.startFrame = Math.max(0, Math.round(message.start * sampleRate));
            this.loop.endFrame = Math.min(this.totalFrames, Math.round(message.end * sampleRate));
            if (this.loop.endFrame <= this.loop.startFrame) this.loop.endFrame = this.totalFrames;
        } else if (message.type === 'seek') {
            this.seek(Math.max(0, Math.round(message.seconds * sampleRate)));
        }
    }

    /* Re-runs the voice from silence up to `target`, discarding the
       samples. Sounds odd until you remember the alternative: a voice
       whose phase and filter state belong to a completely different
       moment in the sketch. ~750 blocks for two seconds, well inside a
       single render quantum's budget on any machine that can play audio. */
    seek(targetFrame) {
        if (this.failed) return;
        const clamped = Math.min(targetFrame, this.totalFrames);
        this.instantiate();
        this.frame = 0;
        this.finished = false;
        if (!this.render) return;
        while (this.frame + this.scratch.length <= clamped) {
            this.scratch.fill(0);
            if (!this.call(this.scratch)) return;
            this.frame += this.scratch.length;
        }
        this.frame = clamped;
        this.postPosition();
    }

    call(block) {
        try {
            this.render(block, { sampleRate, params: this.current });
            return true;
        } catch (error) {
            this.fail(error.message);
            return false;
        }
    }

    glide() {
        for (const name of Object.keys(this.target)) {
            const to = this.target[name];
            const from = this.current[name];
            if (typeof to !== 'number' || !Number.isFinite(to)) continue;
            const next = from + (to - from) * SMOOTHING;
            this.current[name] = Math.abs(to - next) < SNAP_BELOW ? to : next;
        }
    }

    postPosition() {
        this.port.postMessage({ type: 'position', seconds: this.frame / sampleRate });
    }

    process(_inputs, outputs) {
        const output = outputs[0];
        if (!output || !output.length) return true;
        const block = output[0];

        if (this.failed || this.finished) {
            for (const channel of output) channel.fill(0);
            return !this.finished;
        }

        this.glide();
        block.fill(0);
        if (!this.call(block)) {
            for (const channel of output) channel.fill(0);
            return true;
        }

        /* A sketch is free to produce nonsense - an amplitude of 40, or a
           NaN from a divide by zero. Neither should reach the hardware:
           NaN can poison the graph, and 40 is a full-scale square wave in
           someone's headphones. Clamp rather than trust. */
        for (let i = 0; i < block.length; i++) {
            const sample = block[i];
            block[i] = sample >= -1 && sample <= 1 ? sample : sample > 1 ? 1 : sample < -1 ? -1 : 0;
        }

        /* Mono voice, same signal to every output channel. */
        for (let c = 1; c < output.length; c++) output[c].set(block);

        this.frame += block.length;
        const end = this.loop.enabled ? this.loop.endFrame : this.totalFrames;
        if (this.frame >= end) {
            if (this.loop.enabled) {
                this.frame = this.loop.startFrame;
            } else {
                this.frame = this.totalFrames;
                this.finished = true;
                this.postPosition();
                this.port.postMessage({ type: 'ended' });
                return true; // one more silent block, then the node is released
            }
        }

        if (++this.blocks % POSITION_EVERY_BLOCKS === 0) this.postPosition();
        return true;
    }
}

registerProcessor('sketch-live', SketchLiveProcessor);
