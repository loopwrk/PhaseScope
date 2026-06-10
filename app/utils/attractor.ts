import { clamp } from '~/utils/utilities';

/* Lorenz attractor spine for the "attractor" topology, pre-computed at audio
   load time. The RMS envelope of the track modulates the chaos parameter
   rho between 25 and 38, pulling the trajectory between the butterfly's two
   lobes; integration is 4th-order Runge-Kutta, and the per-frame Frenet
   frames are built with parallel transport so tube normals never degenerate
   at inflection points. Pure: (frameCount, samples, hopSize) -> arrays. */

export const precomputeAttractorSpine = (
    frameCount: number,
    ch0: Float32Array,
    hopSize: number
): { spine: Float32Array; normals: Float32Array; binormals: Float32Array } => {
    const σ = 10,
        β = 8 / 3;
    const ρMin = 25,
        ρMax = 38;
    const dt = 0.01;
    const stepsPerFrame = 4;

    // 1. Compute RMS amplitude envelope per frame
    const envelope = new Float32Array(frameCount);
    let maxEnv = 0;
    for (let f = 0; f < frameCount; f++) {
        const start = f * hopSize;
        const end = Math.min(start + hopSize, ch0.length);
        let sum = 0;
        for (let i = start; i < end; i++) {
            const s = ch0[i] ?? 0;
            sum += s * s;
        }
        envelope[f] = Math.sqrt(sum / Math.max(1, end - start));
        if ((envelope[f] ?? 0) > maxEnv) maxEnv = envelope[f] ?? 0;
    }
    if (maxEnv < 0.0001) maxEnv = 0.0001;

    // 2. Warm-up: integrate 5000 steps to settle onto attractor
    let x = 0.1,
        y = 0.0,
        z = 0.0;
    for (let s = 0; s < 5000; s++) {
        const k1x = σ * (y - x),
            k1y = x * (ρMin - z) - y,
            k1z = x * y - β * z;
        const x2 = x + 0.5 * dt * k1x,
            y2 = y + 0.5 * dt * k1y,
            z2 = z + 0.5 * dt * k1z;
        const k2x = σ * (y2 - x2),
            k2y = x2 * (ρMin - z2) - y2,
            k2z = x2 * y2 - β * z2;
        const x3 = x + 0.5 * dt * k2x,
            y3 = y + 0.5 * dt * k2y,
            z3 = z + 0.5 * dt * k2z;
        const k3x = σ * (y3 - x3),
            k3y = x3 * (ρMin - z3) - y3,
            k3z = x3 * y3 - β * z3;
        const x4 = x + dt * k3x,
            y4 = y + dt * k3y,
            z4 = z + dt * k3z;
        const k4x = σ * (y4 - x4),
            k4y = x4 * (ρMin - z4) - y4,
            k4z = x4 * y4 - β * z4;
        x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
        y += (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
        z += (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
    }

    // 3. Integrate trajectory, modulating ρ by the amplitude envelope
    const spine = new Float32Array(frameCount * 3);
    for (let f = 0; f < frameCount; f++) {
        const ρ = ρMin + clamp((envelope[f] ?? 0) / maxEnv, 0, 1) * (ρMax - ρMin);
        for (let s = 0; s < stepsPerFrame; s++) {
            const k1x = σ * (y - x),
                k1y = x * (ρ - z) - y,
                k1z = x * y - β * z;
            const x2 = x + 0.5 * dt * k1x,
                y2 = y + 0.5 * dt * k1y,
                z2 = z + 0.5 * dt * k1z;
            const k2x = σ * (y2 - x2),
                k2y = x2 * (ρ - z2) - y2,
                k2z = x2 * y2 - β * z2;
            const x3 = x + 0.5 * dt * k2x,
                y3 = y + 0.5 * dt * k2y,
                z3 = z + 0.5 * dt * k2z;
            const k3x = σ * (y3 - x3),
                k3y = x3 * (ρ - z3) - y3,
                k3z = x3 * y3 - β * z3;
            const x4 = x + dt * k3x,
                y4 = y + dt * k3y,
                z4 = z + dt * k3z;
            const k4x = σ * (y4 - x4),
                k4y = x4 * (ρ - z4) - y4,
                k4z = x4 * y4 - β * z4;
            x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
            y += (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
            z += (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
        }
        spine[f * 3] = x;
        spine[f * 3 + 1] = y;
        spine[f * 3 + 2] = z;
    }

    // 4. Center and scale to fit scene (diameter 12 → radius 6)
    let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
    for (let f = 0; f < frameCount; f++) {
        const fx = spine[f * 3] ?? 0,
            fy = spine[f * 3 + 1] ?? 0,
            fz = spine[f * 3 + 2] ?? 0;
        if (fx < minX) minX = fx;
        if (fx > maxX) maxX = fx;
        if (fy < minY) minY = fy;
        if (fy > maxY) maxY = fy;
        if (fz < minZ) minZ = fz;
        if (fz > maxZ) maxZ = fz;
    }
    const cx = (minX + maxX) / 2,
        cy = (minY + maxY) / 2,
        cz = (minZ + maxZ) / 2;
    const maxExtent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const scale = maxExtent > 0 ? 12 / maxExtent : 1;
    for (let f = 0; f < frameCount; f++) {
        spine[f * 3] = ((spine[f * 3] ?? 0) - cx) * scale;
        spine[f * 3 + 1] = ((spine[f * 3 + 1] ?? 0) - cy) * scale;
        spine[f * 3 + 2] = ((spine[f * 3 + 2] ?? 0) - cz) * scale;
    }

    // 5. Compute Frenet frames via parallel transport (avoids degenerate normals at inflection points)
    const normals = new Float32Array(frameCount * 3);
    const binormals = new Float32Array(frameCount * 3);

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

    return { spine, normals, binormals };
};
