import { writeFileSync, mkdirSync } from 'node:fs';

/* Shared 16-bit stereo PCM/WAV writer for the preset composers.

   Each composer fills two Float64 channel buffers and hands them here. This
   peak-normalises L and R together to `normalizeTo` (refusing to write
   silence), RIFF-encodes 16-bit interleaved PCM, and writes the file under
   public/audio. Extracting it means a composer is just its score + timbre.

   The output is byte-for-byte what the composers wrote inline before, so any
   regenerated .wav diffs clean against the originals. */
export function writeWav(L, R, { path, sampleRate = 44100, normalizeTo = 0.78 } = {}) {
    if (!path) throw new Error('writeWav: a `path` is required');
    const N = Math.min(L.length, R.length);

    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    if (!Number.isFinite(peak) || peak === 0) {
        throw new Error(`synthesis produced a degenerate signal (peak=${peak}) - refusing to write silence`);
    }
    const gain = normalizeTo / peak;

    const out = Buffer.alloc(44 + N * 4);
    out.write('RIFF', 0);
    out.writeUInt32LE(36 + N * 4, 4);
    out.write('WAVEfmt ', 8);
    out.writeUInt32LE(16, 16);
    out.writeUInt16LE(1, 20); // PCM
    out.writeUInt16LE(2, 22); // stereo
    out.writeUInt32LE(sampleRate, 24);
    out.writeUInt32LE(sampleRate * 4, 28);
    out.writeUInt16LE(4, 32);
    out.writeUInt16LE(16, 34);
    out.write('data', 36);
    out.writeUInt32LE(N * 4, 40);
    for (let i = 0; i < N; i++) {
        out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
        out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
    }

    mkdirSync('public/audio', { recursive: true });
    writeFileSync(path, out);
    console.log(`wrote ${path} (${(out.length / 1e6).toFixed(1)} MB, ${(N / sampleRate).toFixed(0)}s)`);
}
