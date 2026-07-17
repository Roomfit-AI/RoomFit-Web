import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Matrix4,
  Quaternion,
  Shape,
  Vector3,
} from "three";
import type { BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type {
  ExtrudedPolygonFurniturePart,
  FurniturePart,
  ValidatedFurniturePart,
  ValidatedFurnitureVariant,
} from "./types";

const DEFAULT_ROUNDED_BOX_RADIUS = 0.02;
const DEFAULT_ROUNDED_BOX_SMOOTHNESS = 4;
const DEFAULT_CYLINDER_SEGMENTS = 32;
const MAX_ROUNDED_BOX_RADIUS_RATIO = 0.35;

export function createFurniturePartGeometry(
  definition: FurniturePart | ValidatedFurniturePart,
): BufferGeometry {
  switch (definition.geometry) {
    case "box":
      return new BoxGeometry(...definition.size);
    case "roundedBox": {
      const radius = Math.min(
        definition.radius ?? DEFAULT_ROUNDED_BOX_RADIUS,
        Math.min(...definition.size) * MAX_ROUNDED_BOX_RADIUS_RATIO,
      );
      return new RoundedBoxGeometry(
        definition.size[0],
        definition.size[1],
        definition.size[2],
        definition.smoothness ?? DEFAULT_ROUNDED_BOX_SMOOTHNESS,
        radius,
      );
    }
    case "cylinder":
      return new CylinderGeometry(
        definition.size[0],
        definition.size[1],
        definition.size[2],
        definition.radialSegments ?? DEFAULT_CYLINDER_SEGMENTS,
      );
    case "extrudedPolygon":
      return createExtrudedPolygonGeometry(definition);
  }
}

export function computeFurnitureVariantBounds(variant: ValidatedFurnitureVariant): Box3 {
  const bounds = new Box3().makeEmpty();

  for (const part of variant.parts) {
    const geometry = createFurniturePartGeometry(part);
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      const transform = new Matrix4().compose(
        new Vector3(...part.position),
        new Quaternion().setFromEuler(new Euler(...part.rotation, "XYZ")),
        new Vector3(1, 1, 1),
      );
      bounds.union(geometry.boundingBox.clone().applyMatrix4(transform));
    }
    geometry.dispose();
  }

  return bounds;
}

function createExtrudedPolygonGeometry(definition: ExtrudedPolygonFurniturePart): ExtrudeGeometry {
  const shape = new Shape();
  const [first, ...remaining] = definition.points;

  // Shape uses XY and ExtrudeGeometry extrudes along +Z. Negating the source
  // Z coordinate and rotating -90 degrees around X maps the polygon back to
  // RoomFit's XZ plane while mapping extrusion thickness to +Y.
  shape.moveTo(first[0], -first[1]);
  for (const point of remaining) {
    shape.lineTo(point[0], -point[1]);
  }
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    depth: definition.height,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -definition.height / 2, 0);
  geometry.computeVertexNormals();
  return geometry;
}
