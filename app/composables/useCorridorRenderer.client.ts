import * as THREE from 'three';
import type { OscillationMode } from '~/utils/oscillation';

export type RenderMode = 'points' | 'lines';

export interface CorridorConfig {
    totalPoints: number;
    renderMode: Ref<RenderMode>;
    pointsPosition?: { x: number; y: number; z: number };
    linesPosition?: { x: number; y: number; z: number };
}

/* Renders the corridor as Points and Lines objects over ONE pair of shared
   BufferAttributes: both geometries reference the same attribute instances,
   so the GPU holds a single copy of positions/colours and every upload
   happens once.

   Upload contract:
   - The progressive build appends frames to a contiguous span, so build
     ticks call uploadBuiltRange() and only that span is sent to the GPU
     (three.js updateRanges -> gl.bufferSubData).
   - Full rewrites (in-place repaints) call markGeometryForUpdate(),
     which clears pending ranges - empty updateRanges means three.js
     uploads the whole buffer.

   Oscillation runs on the GPU: positions stay pristine anchors, uploaded
   once at build; per-point oscillation data travels in a single half-float
   vec4 attribute (pointFreq, pointAmp, frameAvgFreq, frameAvgAmp); the
   frame index derives from gl_VertexID; and a vertex-shader patch displaces
   each point with the same maths as utils/oscillation.ts (the testable
   reference - keep the two in lockstep). Toggling modes or disabling is a
   uniform write: no CPU loop, no re-upload, instant restore to anchors. */

const OSC_MODE_INT: Record<OscillationMode | 'off', number> = {
    off: 0,
    expressiveness: 1,
    intensity: 2,
    frequency: 3,
};

// Mirrors utils/oscillation.ts (PHASE_SHIFT_Y/Z, WAVE_SPEED, WAVE_LENGTH)
const OSC_GLSL = /* glsl */ `
uniform float uOscTime;
uniform int uOscMode; // 0 off, 1 expressiveness, 2 intensity, 3 frequency
uniform float uBuiltFrames;
uniform float uPointsPerFrame;
attribute vec4 aOsc; // pointFreq, pointAmp, frameCentroidHz, frameAvgAmp

vec3 psOscOffset() {
    if (uOscMode == 0) return vec3(0.0);
    // expressiveness reads the per-point data; intensity/frequency the frame summary
    float freq = (uOscMode == 1) ? aOsc.x : aOsc.z;
    float amp = (uOscMode == 1) ? aOsc.y : aOsc.w;
    float phase;
    if (uOscMode == 2) {
        // intensity: loudness ripple backward from the head, fixed visible speed
        float frameIndex = floor(float(gl_VertexID) / uPointsPerFrame);
        float spatialPhase = ((uBuiltFrames - 1.0 - frameIndex) / 15.0) * 6.28318530718;
        phase = 6.28318530718 * 1.5 * uOscTime - spatialPhase;
        amp = aOsc.w;
    } else {
        // expressiveness (per-point freq) and frequency (frame centroid)
        phase = 6.28318530718 * freq * uOscTime;
    }
    return vec3(sin(phase), sin(phase + 1.04719755), sin(phase + 2.09439510)) * amp;
}
`;

export function useCorridorRenderer(scene: THREE.Scene) {
    const snapshotCorridorPoints = ref<THREE.Points | null>(null);
    const snapshotCorridorLines = ref<THREE.Line | null>(null);

    // The single shared attribute set (referenced by BOTH geometries)
    let posAttr: THREE.BufferAttribute | null = null;
    let colorAttr: THREE.BufferAttribute | null = null;
    let oscAttr: THREE.Float16BufferAttribute | null = null;

    // Shared uniform objects: assigned into both patched materials' shaders,
    // so one value write drives points and lines alike.
    const oscUniforms = {
        uOscTime: { value: 0 },
        uOscMode: { value: 0 },
        uBuiltFrames: { value: 0 },
        uPointsPerFrame: { value: 512 },
    };

    const patchMaterialWithOscillation = (material: THREE.Material) => {
        material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, oscUniforms);
            shader.vertexShader = shader.vertexShader
                .replace('void main() {', `${OSC_GLSL}\nvoid main() {`)
                .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += psOscOffset();');
        };
        material.customProgramCacheKey = () => 'phasescope-oscillation';
    };

    /** Drive the GPU oscillation. Cheap (four uniform writes) - call every frame. */
    const setOscillation = (opts: {
        time: number;
        mode: OscillationMode | 'off';
        builtFrames: number;
        pointsPerFrame: number;
    }) => {
        oscUniforms.uOscTime.value = opts.time;
        oscUniforms.uOscMode.value = OSC_MODE_INT[opts.mode] ?? 0;
        oscUniforms.uBuiltFrames.value = opts.builtFrames;
        oscUniforms.uPointsPerFrame.value = opts.pointsPerFrame;
    };

    const disposeThreeObject = (obj: THREE.Points | THREE.Line | null) => {
        if (!obj) return;

        scene.remove(obj);
        obj.geometry.dispose();

        if (Array.isArray(obj.material)) {
            obj.material.forEach((material) => material.dispose());
        } else {
            obj.material.dispose();
        }
    };

    const clearGeometry = () => {
        disposeThreeObject(snapshotCorridorPoints.value);
        snapshotCorridorPoints.value = null;

        disposeThreeObject(snapshotCorridorLines.value);
        snapshotCorridorLines.value = null;

        posAttr = null;
        colorAttr = null;
        oscAttr = null;
    };

    // Create corridor geometries (both Points and Lines)
    const createGeometry = (config: CorridorConfig) => {
        clearGeometry();

        const { totalPoints, renderMode } = config;
        const stride = 3; // x,y,z / r,g,b

        // Shared arrays AND shared attributes: one GPU buffer for the pair.
        // Oscillation data is half-float: at 60fps the kHz-range point
        // frequencies are stochastic shimmer either way, so 11 bits of
        // mantissa is visually identical at half the memory.
        const positions = new Float32Array(totalPoints * stride);
        const colors = new Float32Array(totalPoints * stride);
        posAttr = markRaw(new THREE.BufferAttribute(positions, stride));
        colorAttr = markRaw(new THREE.BufferAttribute(colors, stride));
        oscAttr = markRaw(new THREE.Float16BufferAttribute(new Uint16Array(totalPoints * 4), 4));
        // CAUTION: Float16BufferAttribute COPIES the array passed to its
        // constructor - the build must write into the attribute's own array,
        // or the GPU reads zeros forever (amp 0 = no oscillation).
        const oscData = oscAttr.array as Uint16Array;
        // The build writes the buffers front-to-back over the whole track
        posAttr.setUsage(THREE.DynamicDrawUsage);
        colorAttr.setUsage(THREE.DynamicDrawUsage);
        oscAttr.setUsage(THREE.DynamicDrawUsage);

        // Create POINTS version
        const gPoints = markRaw(new THREE.BufferGeometry());
        gPoints.setAttribute('position', posAttr);
        gPoints.setAttribute('color', colorAttr);
        gPoints.setAttribute('aOsc', oscAttr);
        gPoints.setDrawRange(0, 0);

        const mPoints = markRaw(
            new THREE.PointsMaterial({
                size: 0.02,
                transparent: true,
                opacity: 0.95,
                vertexColors: true,
            })
        );
        patchMaterialWithOscillation(mPoints);

        const pointsPos = config.pointsPosition || { x: 0, y: 1.7, z: 0.95 };
        const points = markRaw(new THREE.Points(gPoints, mPoints));
        points.position.set(pointsPos.x, pointsPos.y, pointsPos.z);
        points.frustumCulled = false;
        snapshotCorridorPoints.value = points;
        scene.add(points);

        // Create LINES version (same attribute instances - zero extra GPU)
        const gLine = markRaw(new THREE.BufferGeometry());
        gLine.setAttribute('position', posAttr);
        gLine.setAttribute('color', colorAttr);
        gLine.setAttribute('aOsc', oscAttr);
        gLine.setDrawRange(0, 0);

        const mLine = markRaw(
            new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.95,
                linewidth: 1,
            })
        );
        patchMaterialWithOscillation(mLine);

        const linesPos = config.linesPosition || { x: 0, y: 1.7, z: 0 };
        const lines = markRaw(new THREE.Line(gLine, mLine));
        lines.position.set(linesPos.x, linesPos.y, linesPos.z);
        lines.frustumCulled = false;
        snapshotCorridorLines.value = lines;
        scene.add(lines);

        currentMode = renderMode.value;
        applyVisibility();

        return { positions, colors, oscData };
    };

    // Update the draw range for both geometries
    const updateDrawRange = (pointCount: number) => {
        if (snapshotCorridorPoints.value) {
            snapshotCorridorPoints.value.geometry.setDrawRange(0, pointCount);
        }
        if (snapshotCorridorLines.value) {
            snapshotCorridorLines.value.geometry.setDrawRange(0, pointCount);
        }
    };

    /** Upload ONLY the freshly built span of points (positions, colours and
     *  oscillation data). three.js auto-clears ranges after the upload. */
    const uploadBuiltRange = (startPoint: number, pointCount: number) => {
        if (!posAttr || !colorAttr || !oscAttr || pointCount <= 0) return;
        posAttr.addUpdateRange(startPoint * 3, pointCount * 3);
        posAttr.needsUpdate = true;
        colorAttr.addUpdateRange(startPoint * 3, pointCount * 3);
        colorAttr.needsUpdate = true;
        oscAttr.addUpdateRange(startPoint * 4, pointCount * 4);
        oscAttr.needsUpdate = true;
    };

    /** Full-buffer upload, for paths that rewrite points in place (the
     *  in-place repaint). Clearing pending ranges matters: with ranges
     *  queued, three.js would upload only those spans. */
    const markGeometryForUpdate = (updatePositions = true, updateColors = false) => {
        if (updatePositions && posAttr) {
            posAttr.clearUpdateRanges();
            posAttr.needsUpdate = true;
        }
        if (updateColors && colorAttr) {
            colorAttr.clearUpdateRanges();
            colorAttr.needsUpdate = true;
        }
    };

    // Visibility = render mode AND not hidden (the 3D Lissajous scope hides
    // the corridor while it owns the stage; the build continues regardless)
    let currentMode: RenderMode = 'points';
    let corridorHidden = false;
    const applyVisibility = () => {
        if (snapshotCorridorPoints.value) {
            snapshotCorridorPoints.value.visible = !corridorHidden && currentMode === 'points';
        }
        if (snapshotCorridorLines.value) {
            snapshotCorridorLines.value.visible = !corridorHidden && currentMode === 'lines';
        }
    };

    const setRenderMode = (mode: RenderMode) => {
        currentMode = mode;
        applyVisibility();
    };

    const setCorridorVisible = (visible: boolean) => {
        corridorHidden = !visible;
        applyVisibility();
    };

    const getColorArray = (): Float32Array | null => {
        return colorAttr ? (colorAttr.array as Float32Array) : null;
    };

    const hasGeometry = () => {
        return snapshotCorridorPoints.value !== null;
    };

    return {
        snapshotCorridorPoints: readonly(snapshotCorridorPoints),
        snapshotCorridorLines: readonly(snapshotCorridorLines),

        createGeometry,
        clearGeometry,
        updateDrawRange,
        uploadBuiltRange,
        markGeometryForUpdate,
        setOscillation,
        setRenderMode,
        setCorridorVisible,
        getColorArray,
        hasGeometry,
    };
}
