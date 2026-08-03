/* Minimal WAV reader for the sample-based composers: PCM 16/24/32-bit and
 * 32-bit float, any sample rate (the composer compensates with per-file
 * rate factors). Returns fully decoded stereo Float64 channels. */
import { readFileSync } from 'node:fs';

export const readWav = (path) => {
    const b = readFileSync(path);
    if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error(`not a WAV: ${path}`);
    }
    let off = 12;
    let fmt = null;
    let data = null;
    while (off + 8 <= b.length) {
        const id = b.toString('ascii', off, off + 4);
        const size = b.readUInt32LE(off + 4);
        if (id === 'fmt ') {
            fmt = {
                code: b.readUInt16LE(off + 8),
                ch: b.readUInt16LE(off + 10),
                sr: b.readUInt32LE(off + 12),
                bits: b.readUInt16LE(off + 22),
            };
        }
        if (id === 'data') data = { start: off + 8, size: Math.min(size, b.length - off - 8) };
        off += 8 + size + (size % 2);
    }
    if (!fmt || !data) throw new Error(`missing fmt/data chunks: ${path}`);
    const bytesPer = fmt.bits / 8;
    const frames = Math.floor(data.size / (bytesPer * fmt.ch));
    const L = new Float64Array(frames);
    const R = new Float64Array(frames);
    for (let f = 0; f < frames; f++) {
        for (let c = 0; c < Math.min(2, fmt.ch); c++) {
            const p = data.start + (f * fmt.ch + c) * bytesPer;
            let v = 0;
            if (fmt.code === 3 && fmt.bits === 32) v = b.readFloatLE(p);
            else if (fmt.bits === 16) v = b.readInt16LE(p) / 32768;
            else if (fmt.bits === 24) v = (((b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) << 8) >> 8) / 8388608;
            else if (fmt.bits === 32) v = b.readInt32LE(p) / 2147483648;
            if (c === 0) L[f] = v;
            if (c === 1 || fmt.ch === 1) R[f] = v;
        }
    }
    return { sr: fmt.sr, frames, L, R };
};
