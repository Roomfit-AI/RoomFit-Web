import { useMemo } from "react";
import * as THREE from "three";
import Material from "../materials/Material";
import { materialFromConfig } from "../materials/materialConfig";
import type { RoomLayout, WallSegment } from "../../types";

const FLOOR_THICKNESS = 0.05;
const CLOSED_LOOP_EPSILON = 0.02;

export default function Floor({ room }: { room: RoomLayout }) {
  const width = room.floor?.size.width ?? room.width;
  const depth = room.floor?.size.depth ?? room.depth;
  const color = room.floor?.material.color ?? "#c2996a";
  const roughness = room.floor?.material.roughness ?? 0.68;

  const polygonGeometry = useMemo(() => buildFloorPolygonGeometry(room.walls), [room.walls]);

  return (
    <group>
      {polygonGeometry ? (
        <mesh receiveShadow geometry={polygonGeometry}>
          {/* DoubleSide, not the shared <Material>: an L-shaped/concave
              polygon's cap-face winding (and therefore which way its normal
              faces) depends on the wall ordering RoomPlan/the backend hand
              us, so a single-sided material could render the floor invisible
              from the app's top-down camera for some room shapes. */}
          <meshStandardMaterial
            color={materialFromConfig("wood", color).color}
            roughness={roughness}
            metalness={materialFromConfig("wood", color).metalness}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : (
        <mesh receiveShadow position={[0, -0.025, 0]}>
          <boxGeometry args={[width, 0.05, depth]} />
          <Material type="wood" color={color} roughness={roughness} />
        </mesh>
      )}
      <FloorLines width={width} depth={depth} />
    </group>
  );
}

function FloorLines({ width, depth }: { width: number; depth: number }) {
  const lines = Array.from({ length: 8 }, (_, index) => index);

  return (
    <group>
      {lines.map((index) => (
        <mesh key={`x-${index}`} position={[-width / 2 + index * (width / 7), 0.004, 0]}>
          <boxGeometry args={[0.012, 0.006, depth]} />
          <meshBasicMaterial color="#8f6a44" transparent opacity={0.42} />
        </mesh>
      ))}
      {lines.map((index) => (
        <mesh key={`z-${index}`} position={[0, 0.005, -depth / 2 + index * (depth / 7)]}>
          <boxGeometry args={[width, 0.006, 0.012]} />
          <meshBasicMaterial color="#8f6a44" transparent opacity={0.34} />
        </mesh>
      ))}
    </group>
  );
}

// Walls arrive chained in perimeter order (each wall's `end` meets the next
// wall's `start`), so their `start` points alone trace the room's true
// footprint polygon — including non-rectangular shapes (L-shaped studios,
// alcoves) that a width x depth bounding box would square off. `ExtrudeGeometry`
// turns that flat outline into a thin slab, oriented flat (rotated onto the
// XZ plane) since its native extrusion runs along Z.
function buildFloorPolygonGeometry(walls: WallSegment[]): THREE.BufferGeometry | null {
  if (walls.length < 3) {
    return null;
  }

  const points = walls.map((wall) => wall.start);
  const last = walls[walls.length - 1];
  const closesLoop = Math.hypot(last.end.x - points[0].x, last.end.z - points[0].z) <= CLOSED_LOOP_EPSILON;
  if (!closesLoop) {
    return null;
  }

  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) {
      shape.moveTo(point.x, point.z);
    } else {
      shape.lineTo(point.x, point.z);
    }
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: FLOOR_THICKNESS,
    bevelEnabled: false,
  });
  // ExtrudeGeometry extrudes a shape drawn in the XY plane (shape-X, shape-Y)
  // along +Z (0..FLOOR_THICKNESS). Rotating +90° about X maps
  // (shapeX, shapeY, extrudeZ) -> (shapeX, -extrudeZ, shapeY): shape-Y lands
  // back on world Z untouched (no left-right mirror vs. Wall.tsx/openings,
  // which use room.z directly) and the extrusion becomes world Y in
  // [-FLOOR_THICKNESS, 0] — top surface at y=0, matching the old box's
  // position=[0,-0.025,0] convention without needing a separate offset here.
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
