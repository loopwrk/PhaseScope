import { clamp } from '~/utils/utilities';

/* Parallel-transport Frenet frames along a spine.

   Given a polyline spine (frameCount points packed xyz), produce a normal and a
   binormal at each point that rotate minimally from one point to the next - so a
   tube built on these frames never twists arbitrarily or degenerates at
   inflection points (where a naive Frenet normal flips). This is the shared
   machinery behind every "trajectory" topology: the Lorenz attractor and the
   Poincaré sphere both hand their spine here to get tube frames. Pure. */
export const parallelTransportFrames = (
    spine: Float32Array,
    frameCount: number
): { normals: Float32Array; binormals: Float32Array } => {
    const normals = new Float32Array(frameCount * 3);
    const binormals = new Float32Array(frameCount * 3);
    if (frameCount === 0) return { normals, binormals };

    // Initial tangent T0 = normalize(P1 - P0)
    let tx = (spine[3] ?? 0) - (spine[0] ?? 0),
        ty = (spine[4] ?? 0) - (spine[1] ?? 0),
        tz = (spine[5] ?? 0) - (spine[2] ?? 0);
    let tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (tlen < 1e-10) tlen = 1;
    tx /= tlen;
    ty /= tlen;
    tz /= tlen;

    // Initial normal via Gram-Schmidt with an arbitrary reference vector
    let ax = 0,
        ay = 1,
        az = 0;
    if (Math.abs(ty) > 0.9) {
        ax = 1;
        ay = 0;
    }
    const d0 = ax * tx + ay * ty + az * tz;
    ax -= d0 * tx;
    ay -= d0 * ty;
    az -= d0 * tz;
    let nlen = Math.sqrt(ax * ax + ay * ay + az * az);
    if (nlen < 1e-10) nlen = 1;
    let nx = ax / nlen,
        ny = ay / nlen,
        nz = az / nlen;
    let bx = ty * nz - tz * ny,
        by = tz * nx - tx * nz,
        bz = tx * ny - ty * nx;
    normals[0] = nx;
    normals[1] = ny;
    normals[2] = nz;
    binormals[0] = bx;
    binormals[1] = by;
    binormals[2] = bz;

    for (let f = 1; f < frameCount; f++) {
        const pi = f * 3,
            pp = (f - 1) * 3;
        let ntx = (spine[pi] ?? 0) - (spine[pp] ?? 0),
            nty = (spine[pi + 1] ?? 0) - (spine[pp + 1] ?? 0),
            ntz = (spine[pi + 2] ?? 0) - (spine[pp + 2] ?? 0);
        let ntlen = Math.sqrt(ntx * ntx + nty * nty + ntz * ntz);
        if (ntlen < 1e-10) ntlen = 1;
        ntx /= ntlen;
        nty /= ntlen;
        ntz /= ntlen;

        // Rotation axis = T × T_new (parallel transport step)
        const rax = ty * ntz - tz * nty,
            ray = tz * ntx - tx * ntz,
            raz = tx * nty - ty * ntx;
        const raLen = Math.sqrt(rax * rax + ray * ray + raz * raz);
        if (raLen > 1e-8) {
            const rnx = rax / raLen,
                rny = ray / raLen,
                rnz = raz / raLen;
            const cosA = clamp(tx * ntx + ty * nty + tz * ntz, -1, 1);
            const sinA = raLen;
            const rdot = rnx * nx + rny * ny + rnz * nz;
            const crossX = rny * nz - rnz * ny,
                crossY = rnz * nx - rnx * nz,
                crossZ = rnx * ny - rny * nx;
            nx = nx * cosA + crossX * sinA + rnx * rdot * (1 - cosA);
            ny = ny * cosA + crossY * sinA + rny * rdot * (1 - cosA);
            nz = nz * cosA + crossZ * sinA + rnz * rdot * (1 - cosA);
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (nl > 1e-10) {
                nx /= nl;
                ny /= nl;
                nz /= nl;
            }
        }
        bx = nty * nz - ntz * ny;
        by = ntz * nx - ntx * nz;
        bz = ntx * ny - nty * nx;
        normals[f * 3] = nx;
        normals[f * 3 + 1] = ny;
        normals[f * 3 + 2] = nz;
        binormals[f * 3] = bx;
        binormals[f * 3 + 1] = by;
        binormals[f * 3 + 2] = bz;
        tx = ntx;
        ty = nty;
        tz = ntz;
    }

    return { normals, binormals };
};
