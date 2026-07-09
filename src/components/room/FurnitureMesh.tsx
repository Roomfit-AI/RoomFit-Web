import { TransformControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import FurnitureRenderer from "../furniture/FurnitureRenderer";
import type { Furniture, Vector2D } from "../../types";

interface FurnitureMeshProps {
  item: Furniture;
  isSelected: boolean;
  canTransform: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, position: Vector2D) => void;
}

export function FurnitureMesh({
  item,
  isSelected,
  canTransform,
  onSelect,
  onMove,
}: FurnitureMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
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

    onMove(item.id, {
      x: groupRef.current.position.x,
      z: groupRef.current.position.z,
    });
  };

  const meshGroup = (
    <group
      ref={groupRef}
      position={[item.position.x, heightOffset, item.position.z]}
      rotation={[0, item.rotationY, 0]}
      onPointerDown={handlePointerDown}
    >
      <FurnitureRenderer item={item} />
      {isSelected && (
        <mesh position={[0, item.dimensions.height / 2 + 0.045, 0]}>
          <boxGeometry args={[item.dimensions.width + 0.1, 0.035, item.dimensions.depth + 0.1]} />
          <meshStandardMaterial color="#111111" transparent opacity={0.16} />
        </mesh>
      )}
    </group>
  );

  if (isSelected && canTransform) {
    return (
      <TransformControls
        mode="translate"
        showY={false}
        translationSnap={0.05}
        onMouseUp={commitPosition}
        onObjectChange={commitPosition}
      >
        {meshGroup}
      </TransformControls>
    );
  }

  return meshGroup;
}
