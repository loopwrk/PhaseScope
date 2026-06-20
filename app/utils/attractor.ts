import { clamp } from '~/utils/utilities';
import { parallelTransportFrames } from '~/utils/spine';

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

    // 5. Frenet frames via parallel transport (shared with the other trajectory
    //    topologies - avoids degenerate normals at inflection points)
    const { normals, binormals } = parallelTransportFrames(spine, frameCount);

    return { spine, normals, binormals };
};
