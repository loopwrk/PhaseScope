import * as THREE from 'three';

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
   happens once, not twice.

   Upload contract (this is where long tracks live or die):
   - The progressive build appends frames to a contiguous span, so build
     ticks call uploadBuiltRange() and only that span is sent to the GPU
     (three.js updateRanges -> gl.bufferSubData). A 10-minute track stops
     costing a ~150MB re-upload per tick and costs ~40KB instead.
   - Full rewrites (oscillation displacing every built point, the narrative
     transform repainting) call markGeometryForUpdate(), which clears any
     pending ranges - empty updateRanges means three.js uploads the whole
     buffer, which is exactly right for those paths. */
export function useCorridorRenderer(scene: THREE.Scene) {
    const snapshotCorridorPoints = ref<THREE.Points | null>(null);
    const snapshotCorridorLines = ref<THREE.Line | null>(null);

    // The single shared attribute pair (referenced by BOTH geometries)
    let posAttr: THREE.BufferAttribute | null = null;
    let colorAttr: THREE.BufferAttribute | null = null;

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
    };

    // Create corridor geometries (both Points and Lines)
    const createGeometry = (config: CorridorConfig) => {
        clearGeometry();

        const { totalPoints, renderMode } = config;
        const stride = 3; // x,y,z / r,g,b

        // Shared arrays AND shared attributes: one GPU buffer for the pair
        const positions = new Float32Array(totalPoints * stride);
        const colors = new Float32Array(totalPoints * stride);
        posAttr = markRaw(new THREE.BufferAttribute(positions, stride));
        colorAttr = markRaw(new THREE.BufferAttribute(colors, stride));
        // The build writes the buffer front-to-back over the whole track
        posAttr.setUsage(THREE.DynamicDrawUsage);
        colorAttr.setUsage(THREE.DynamicDrawUsage);

        // Create POINTS version
        const gPoints = markRaw(new THREE.BufferGeometry());
        gPoints.setAttribute('position', posAttr);
        gPoints.setAttribute('color', colorAttr);
        gPoints.setDrawRange(0, 0);

        const mPoints = markRaw(
            new THREE.PointsMaterial({
                size: 0.02,
                transparent: true,
                opacity: 0.95,
                vertexColors: true,
            })
        );

        const pointsPos = config.pointsPosition || { x: 0, y: 1.7, z: 0.95 };
        const points = markRaw(new THREE.Points(gPoints, mPoints));
        points.position.set(pointsPos.x, pointsPos.y, pointsPos.z);
        points.frustumCulled = false;
        points.visible = renderMode.value === 'points';
        snapshotCorridorPoints.value = points;
        scene.add(points);

        // Create LINES version (same attribute instances - zero extra GPU)
        const gLine = markRaw(new THREE.BufferGeometry());
        gLine.setAttribute('position', posAttr);
        gLine.setAttribute('color', colorAttr);
        gLine.setDrawRange(0, 0);

        const mLine = markRaw(
            new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.95,
                linewidth: 1,
            })
        );

        const linesPos = config.linesPosition || { x: 0, y: 1.7, z: 0 };
        const lines = markRaw(new THREE.Line(gLine, mLine));
        lines.position.set(linesPos.x, linesPos.y, linesPos.z);
        lines.frustumCulled = false;
        lines.visible = renderMode.value === 'lines';
        snapshotCorridorLines.value = lines;
        scene.add(lines);

        return { positions, colors };
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

    /** Upload ONLY the freshly built span of points (positions + colours).
     *  three.js auto-clears the ranges after the next render's upload. */
    const uploadBuiltRange = (startPoint: number, pointCount: number) => {
        if (!posAttr || !colorAttr || pointCount <= 0) return;
        posAttr.addUpdateRange(startPoint * 3, pointCount * 3);
        posAttr.needsUpdate = true;
        colorAttr.addUpdateRange(startPoint * 3, pointCount * 3);
        colorAttr.needsUpdate = true;
    };

    /** Full-buffer upload, for paths that rewrite points in place
     *  (oscillation; narrative repaint). Clearing pending ranges matters:
     *  with ranges queued, three.js would upload only those spans and the
     *  in-place rewrites of older frames would never reach the GPU. */
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

    const setRenderMode = (mode: RenderMode) => {
        if (snapshotCorridorPoints.value) {
            snapshotCorridorPoints.value.visible = mode === 'points';
        }
        if (snapshotCorridorLines.value) {
            snapshotCorridorLines.value.visible = mode === 'lines';
        }
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
        setRenderMode,
        getColorArray,
        hasGeometry,
    };
}
