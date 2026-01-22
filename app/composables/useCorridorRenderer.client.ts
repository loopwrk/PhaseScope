import * as THREE from "three";

export type RenderMode = 'points' | 'lines';

export interface CorridorConfig {
  totalPoints: number;
  renderMode: Ref<RenderMode>;
  pointsPosition?: { x: number; y: number; z: number };
  linesPosition?: { x: number; y: number; z: number };
}

export interface GeometryUpdateData {
  positions: Float32Array;
  colors?: Float32Array;
}

export function useCorridorRenderer(scene: THREE.Scene) {
  const snapshotCorridorPoints = ref<THREE.Points | null>(null);
  const snapshotCorridorLines = ref<THREE.Line | null>(null);

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
  };

  // Create corridor geometries (both Points and Lines)
  const createGeometry = (config: CorridorConfig) => {
    clearGeometry();

    const { totalPoints, renderMode } = config;
    const positionArrayMultiplier = 3; // x, y, z
    const colorArrayMultiplier = 3; // r, g, b

    // Allocate shared arrays
    const positions = new Float32Array(totalPoints * positionArrayMultiplier);
    const colors = new Float32Array(totalPoints * colorArrayMultiplier);

    // Create POINTS version
    const gPoints = markRaw(new THREE.BufferGeometry());
    gPoints.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, positionArrayMultiplier),
    );
    gPoints.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, colorArrayMultiplier),
    );
    gPoints.setDrawRange(0, 0);

    const mPoints = markRaw(
      new THREE.PointsMaterial({
        size: 0.02,
        transparent: true,
        opacity: 0.95,
        vertexColors: true,
      }),
    );

    const pointsPos = config.pointsPosition || { x: 0, y: 1.7, z: 0.95 };
    const points = markRaw(new THREE.Points(gPoints, mPoints));
    points.position.set(pointsPos.x, pointsPos.y, pointsPos.z);
    points.frustumCulled = false;
    points.visible = renderMode.value === 'points';
    snapshotCorridorPoints.value = points;
    scene.add(points);

    // Create LINES version (shares same position/color arrays)
    const gLine = markRaw(new THREE.BufferGeometry());
    gLine.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, positionArrayMultiplier),
    );
    gLine.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, colorArrayMultiplier),
    );
    gLine.setDrawRange(0, 0);

    const mLine = markRaw(
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        linewidth: 1,
      }),
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

  const markGeometryForUpdate = (
    updatePositions = true,
    updateColors = false,
  ) => {
    if (snapshotCorridorPoints.value) {
      const pointsPos =
        snapshotCorridorPoints.value.geometry.attributes.position;
      const pointsColor =
        snapshotCorridorPoints.value.geometry.attributes.color;
      if (updatePositions && pointsPos) pointsPos.needsUpdate = true;
      if (updateColors && pointsColor) pointsColor.needsUpdate = true;
    }
    if (snapshotCorridorLines.value) {
      const linesPos = snapshotCorridorLines.value.geometry.attributes.position;
      const linesColor = snapshotCorridorLines.value.geometry.attributes.color;
      if (updatePositions && linesPos) linesPos.needsUpdate = true;
      if (updateColors && linesColor) linesColor.needsUpdate = true;
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
    if (!snapshotCorridorPoints.value) return null;
    const colorAttr = snapshotCorridorPoints.value.geometry.attributes.color;
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
    markGeometryForUpdate,
    setRenderMode,
    getColorArray,
    hasGeometry,
  };
}
