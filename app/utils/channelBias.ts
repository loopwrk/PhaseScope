/* Channel bias - the stereo field pulled apart into left/right populations.
 */

export interface ChannelBiasVector {
    x: number;
    y: number;
    z: number;
}

export interface ChannelBiasParams {
    L: number;
    R: number;
    normalizedAmp: number;
    frameIndex: number;
    uAngle: number;
}

/** How much of z survives at full strength - the camera's head tracking
 *  uses this to follow the crushed corridor. */
export const CHANNEL_BIAS_Z_KEEP = 0.4;

export const channelBiasTransform = (v: ChannelBiasVector, params: ChannelBiasParams, s: number): ChannelBiasVector => {
    const seed = (params.frameIndex * 131 + Math.floor(params.uAngle * 1000)) % 997;
    const jitter = (seed / 997 - 0.5) * 0.015;
    const side = Math.sign(params.L - params.R) || 1;
    const split = side * (0.65 + params.normalizedAmp * 0.35) * s;
    return {
        x: v.x * (1 - 0.65 * s) + split,
        y: v.y * (1 - 0.45 * s) + jitter,
        z: v.z * (1 - 0.6 * s),
    };
};
