import type { Ref } from 'vue';
import { clamp } from '~/utils/utilities';

export type NarrativeStage =
    | 'channel-bias'
    | 'tilt'
    | 'folding'
    | 'coils'
    | 'stabilization'
    | 'z-axis-scaling'
    | 'radial-flattening'
    | 'radial-scaling';

interface NarrativeCorridorState {
    buffer: AudioBuffer | null;
    frameCount: number;
    builtFrames: number;
}

interface NarrativeTransformParams {
    L: number;
    R: number;
    normalizedAmp: number;
    uAngle: number;
    frameIndex: number;
    frameCount: number;
    z0: number;
}

interface NarrativeVector3 {
    x: number;
    y: number;
    z: number;
}

export const useNarrativeTransform = (corridorState: Ref<NarrativeCorridorState>) => {
    const narrativeEnabled = ref(false);
    const narrativeAutoStage = ref(true);
    const narrativeStage = ref<NarrativeStage>('channel-bias');

    const narrativeHandedBias = ref(0.22);

    const narrativeProgress = computed(() => {
        if (!corridorState.value.buffer || corridorState.value.frameCount <= 0) return 0;
        return clamp(corridorState.value.builtFrames / corridorState.value.frameCount, 0, 1);
    });

    const narrativeAutoDerivedStage = computed<NarrativeStage>(() => {
        const p = narrativeProgress.value;
        if (p < 0.1) return 'channel-bias';
        if (p < 0.22) return 'tilt';
        if (p < 0.42) return 'folding';
        if (p < 0.62) return 'coils';
        if (p < 0.78) return 'stabilization';
        if (p < 0.88) return 'z-axis-scaling';
        if (p < 0.94) return 'radial-flattening';
        return 'radial-scaling';
    });

    const activeNarrativeStage = computed<NarrativeStage>(() => {
        if (!narrativeEnabled.value) return 'channel-bias';
        return narrativeAutoStage.value ? narrativeAutoDerivedStage.value : narrativeStage.value;
    });

    const activeNarrativeStageStrength = computed(() => {
        if (!narrativeEnabled.value) return 0;
        if (!narrativeAutoStage.value) return 1;

        const p = narrativeProgress.value;
        const seg = (start: number, end: number) => {
            const t = clamp((p - start) / Math.max(0.0001, end - start), 0, 1);
            return t * t * (3 - 2 * t);
        };

        const sUr = seg(0.0, 0.1);
        const sTilt = seg(0.1, 0.22);
        const sFold = seg(0.22, 0.42);
        const sCoil = seg(0.42, 0.62);
        const sStab = seg(0.62, 0.78);
        const sTime = seg(0.78, 0.88);
        const sPhot = seg(0.88, 0.94);
        const sMat = seg(0.94, 1.0);

        switch (narrativeAutoDerivedStage.value) {
            case 'channel-bias':
                return sUr;
            case 'tilt':
                return sTilt;
            case 'folding':
                return sFold;
            case 'coils':
                return sCoil;
            case 'stabilization':
                return sStab;
            case 'z-axis-scaling':
                return sTime;
            case 'radial-flattening':
                return sPhot;
            case 'radial-scaling':
                return sMat;
            default:
                return 1;
        }
    });

    const applyNarrativeTransform = (base: NarrativeVector3, params: NarrativeTransformParams) => {
        if (!narrativeEnabled.value) return base;

        const stage = activeNarrativeStage.value;
        const s = activeNarrativeStageStrength.value;
        const bias = narrativeHandedBias.value;

        const seed = (params.frameIndex * 131 + Math.floor(params.uAngle * 1000)) % 997;
        const jitter = (seed / 997 - 0.5) * 0.015;

        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const rotY = (v: NarrativeVector3, ang: number) => {
            const ca = Math.cos(ang);
            const sa = Math.sin(ang);
            return { x: v.x * ca + v.z * sa, y: v.y, z: -v.x * sa + v.z * ca };
        };
        const rotX = (v: NarrativeVector3, ang: number) => {
            const ca = Math.cos(ang);
            const sa = Math.sin(ang);
            return { x: v.x, y: v.y * ca - v.z * sa, z: v.y * sa + v.z * ca };
        };
        const reflectZ = (v: NarrativeVector3) => ({ x: v.x, y: v.y, z: -v.z });

        let v = { ...base };

        if (stage === 'channel-bias') {
            const side = Math.sign(params.L - params.R) || 1;
            const split = side * (0.65 + params.normalizedAmp * 0.35) * s;
            v.x = v.x * (1 - 0.65 * s) + split;
            v.y = v.y * (1 - 0.85 * s) + jitter;
            v.z = v.z * (1 - 0.95 * s);
        }

        if (stage === 'tilt') {
            const ang = bias * 1.2 * s;
            v = rotY(v, ang);
            v = rotX(v, -bias * 0.45 * s);
        }

        if (stage === 'folding') {
            const foldDepth = lerp(0.15, 1.0, params.normalizedAmp) * s;
            const ang = (bias + 0.12) * 2.2 * foldDepth;

            const afterD = reflectZ(v);
            const afterN = rotY(afterD, ang);

            v.x = lerp(v.x, afterN.x, foldDepth);
            v.y = lerp(v.y, afterN.y, foldDepth);
            v.z = lerp(v.z, afterN.z, foldDepth);
        }

        if (stage === 'coils') {
            const p = params.frameCount > 0 ? params.frameIndex / params.frameCount : 0;
            const twist = (p * 6.0 + params.normalizedAmp * 2.0) * bias * s;
            v = rotY(v, twist);

            v.y += Math.sin(params.uAngle * 2 + p * Math.PI * 4) * 0.35 * params.normalizedAmp * s;
        }

        if (stage === 'stabilization') {
            const damp = 0.55 * s;
            v.x *= 1 - damp * 0.35;
            v.y *= 1 - damp * 0.25;
            v.z *= 1 - damp * 0.1;
        }

        if (stage === 'z-axis-scaling') {
            const zScale = lerp(0.05, 1.0, s);
            v.z = params.z0 * zScale + (v.z - params.z0);
        }

        if (stage === 'radial-flattening') {
            const flat = 0.65 * s;
            v.x *= 1 - flat;
            v.y *= 1 - flat * 0.75;
            v.z *= 1 + 0.35 * s;
        }

        if (stage === 'radial-scaling') {
            const thicken = 0.35 * s;
            v.x *= 1 + thicken * (0.3 + params.normalizedAmp);
            v.y *= 1 + thicken * (0.2 + params.normalizedAmp);
            v.z *= 1 - 0.08 * s;
        }

        return v;
    };

    return {
        narrativeEnabled,
        narrativeAutoStage,
        narrativeStage,
        narrativeHandedBias,
        narrativeProgress,
        activeNarrativeStage,
        applyNarrativeTransform,
    };
};
