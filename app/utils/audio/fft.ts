/* A small, allocation-free iterative radix-2 FFT (Cooley-Tukey, decimation in
   time). Twiddle factors and the bit-reversal permutation are precomputed once
   per size; transform() then runs IN PLACE over caller-owned Float32Arrays, so
   the hot path allocates nothing and touches no trig.

   Forward transform only - the visualiser reads the spectrum, it never needs to
   resynthesise from it. The algorithm is the textbook iterative FFT (cf. the
   public-domain Nayuki reference); the value here is the engine plumbing: fixed
   size, precomputed tables, reusable scratch, so it can run once per geometry
   frame without churning the GC. */
export class FFT {
    readonly n: number;
    private readonly cosTable: Float32Array;
    private readonly sinTable: Float32Array;
    private readonly rev: Uint32Array;

    constructor(size: number) {
        if (size < 2 || (size & (size - 1)) !== 0) {
            throw new Error(`FFT size must be a power of two >= 2, got ${size}`);
        }
        this.n = size;
        const levels = Math.log2(size);
        const half = size >> 1;

        // Twiddles W_k = exp(-2*pi*i*k/N), k = 0..N/2-1
        this.cosTable = new Float32Array(half);
        this.sinTable = new Float32Array(half);
        for (let i = 0; i < half; i++) {
            this.cosTable[i] = Math.cos((2 * Math.PI * i) / size);
            this.sinTable[i] = Math.sin((2 * Math.PI * i) / size);
        }

        // Bit-reversal permutation table
        this.rev = new Uint32Array(size);
        for (let i = 0; i < size; i++) {
            let x = i;
            let r = 0;
            for (let b = 0; b < levels; b++) {
                r = (r << 1) | (x & 1);
                x >>= 1;
            }
            this.rev[i] = r;
        }
    }

    /** In-place forward FFT. `re` and `im` must each be length `n`; for real
     *  input pass an all-zero `im`. Both arrays are overwritten with the
     *  transform (re/im of each frequency bin). */
    transform(re: Float32Array, im: Float32Array): void {
        const n = this.n;
        const { cosTable, sinTable, rev } = this;

        // Reorder into bit-reversed addresses (one swap per mirrored pair)
        for (let i = 0; i < n; i++) {
            const j = rev[i]!;
            if (j > i) {
                const tr = re[i]!;
                re[i] = re[j]!;
                re[j] = tr;
                const ti = im[i]!;
                im[i] = im[j]!;
                im[j] = ti;
            }
        }

        // Butterflies, doubling the block size each stage
        for (let len = 2; len <= n; len <<= 1) {
            const half = len >> 1;
            const step = n / len; // stride into the twiddle tables
            for (let i = 0; i < n; i += len) {
                for (let j = i, k = 0; j < i + half; j++, k += step) {
                    const cr = cosTable[k]!;
                    const si = sinTable[k]!;
                    const ar = re[j + half]!;
                    const ai = im[j + half]!;
                    // (ar + i*ai) * (cos - i*sin)
                    const tr = ar * cr + ai * si;
                    const ti = ai * cr - ar * si;
                    re[j + half] = re[j]! - tr;
                    im[j + half] = im[j]! - ti;
                    re[j] = re[j]! + tr;
                    im[j] = im[j]! + ti;
                }
            }
        }
    }
}
