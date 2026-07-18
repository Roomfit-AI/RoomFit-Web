import { TransformControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import FurnitureRenderer from "../furniture/FurnitureRenderer";
import type { Furniture, RoomLayout, Vector2D } from "../../types";
import type { PreferredColorToneId } from "../../config/preferredColorTone";
import {
  clampFurniturePositionToRoom,
  resolveFurnitureLocalFootprint,
} from "./furnitureBoundary";

interface FurnitureMeshProps {
  item: Furniture;
  room: Pick<RoomLayout, "width" | "depth" | "walls">;
  isSelected: boolean;
  canTransform: boolean;
  showSelectionIndicator: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, position: Vector2D) => void;
  preferredColorTone?: PreferredColorToneId | null;
}

export function FurnitureMesh({
  item,
  room,
  isSelected,
  canTransform,
  showSelectionIndicator,
  onSelect,
  onMove,
  preferredColorTone,
}: FurnitureMeshProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const heightOffset = item.dimensions.height / 2;

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.position.set(item.position.x, heightOffset, item.position.z);
    groupRef.current.rotation.y = item.rotationY;
  }, [heightOffset, item.position.x, item.position.z, item.rotationY]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onSelect(item.id);
  };

  const commitPosition = () => {
    if (!groupRef.current) {
      return;
    }

    const position = clampFurniturePositionToRoom(room, item.dimensions, {
      x: groupRef.current.position.x,
      z: groupRef.current.position.z,
    }, item.rotationY, resolveFurnitureLocalFootprint(item));
    if (!position) {
      groupRef.current.position.set(item.position.x, heightOffset, item.position.z);
      return;
    }
    groupRef.current.position.x = position.x;
    groupRef.current.position.z = position.z;
    onMove(item.id, position);
  };

  const meshGroup = (
    <group
      ref={groupRef}
      position={[item.position.x, heightOffset, item.position.z]}
      rotation={[0, item.rotationY, 0]}
      onPointerDown={handlePointerDown}
    >
      <FurnitureRenderer item={item} preferredColorTone={preferredColorTone} />
      {isSelected && showSelectionIndicator && (
        <mesh position={[0, item.dimensions.height / 2 + 0.045, 0]}>
          <boxGeometry args={[item.dimensions.width + 0.1, 0.035, item.dimensions.depth + 0.1]} />
          <meshStandardMaterial color="#111111" transparent opacity={0.16} />
        </mesh>
      )}
    </group>
  );

  if (isSelected && canTransform) {
    // `meshGroup` is rendered as a *sibling*, not nested inside
    // <TransformControls>, and `object={groupRef}` points it straight at our
    // own group. Nesting it as `children` used to cause two compounding bugs:
    // drei's TransformControls attaches to a wrapper <group> *it* creates
    // around `children` when no `object` is given, not to `meshGroup` itself,
    // so dragging moved that invisible wrapper while commitPosition() kept
    // reading groupRef's (unmoved) position. And even after passing `object`,
    // its attach effect still lists `children` in its dependency array — a
    // new `meshGroup` element (a fresh reference every render, since it
    // embeds the constantly-changing `item.position`) made that effect
    // detach+reattach the gizmo on every single drag tick, resetting its
    // internal drag state each time and cancelling out any net movement.
    // With no children passed here, that dependency never changes and the
    // gizmo attaches exactly once.
    return (
      <>
        {meshGroup}
        <TransformControls
          object={groupRef}
          mode="translate"
          showY={false}
          translationSnap={0.05}
          onMouseUp={commitPosition}
          onObjectChange={commitPosition}
        />
      </>
    );
  }

  return meshGroup;
}
