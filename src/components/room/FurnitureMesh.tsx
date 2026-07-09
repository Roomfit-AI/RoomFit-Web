import { TransformControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
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

  const material = useMemo(
    () => (
      <meshStandardMaterial
        color={item.color}
        roughness={item.material === "metal" ? 0.38 : 0.74}
        metalness={item.material === "metal" ? 0.38 : 0.02}
      />
    ),
    [item.color, item.material],
  );

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
      <FurnitureShape item={item} material={material} />
      {isSelected && (
        <mesh position={[0, item.dimensions.height / 2 + 0.035, 0]}>
          <boxGeometry args={[item.dimensions.width + 0.08, 0.035, item.dimensions.depth + 0.08]} />
          <meshStandardMaterial color="#111827" transparent opacity={0.16} />
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

interface FurnitureShapeProps {
  item: Furniture;
  material: ReactElement;
}

function FurnitureShape({ item, material }: FurnitureShapeProps) {
  if (item.category === "lighting") {
    return (
      <>
        <mesh castShadow receiveShadow position={[0, -item.dimensions.height / 2 + 0.04, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.08, 32]} />
          {material}
        </mesh>
        <mesh castShadow position={[0, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, item.dimensions.height, 24]} />
          {material}
        </mesh>
        <mesh castShadow position={[0.09, item.dimensions.height / 2 - 0.14, 0]}>
          <sphereGeometry args={[0.16, 24, 16]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.45} />
        </mesh>
      </>
    );
  }

  if (item.category === "chair") {
    return (
      <>
        <mesh castShadow receiveShadow position={[0, -0.08, 0]}>
          <boxGeometry args={[item.dimensions.width, 0.16, item.dimensions.depth]} />
          {material}
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.22, item.dimensions.depth / 2 - 0.06]}>
          <boxGeometry args={[item.dimensions.width, 0.58, 0.08]} />
          {material}
        </mesh>
      </>
    );
  }

  if (item.category === "rug") {
    return (
      <mesh receiveShadow position={[0, -item.dimensions.height / 2 + 0.018, 0]}>
        <boxGeometry args={[item.dimensions.width, item.dimensions.height, item.dimensions.depth]} />
        <meshStandardMaterial color={item.color} roughness={0.9} />
      </mesh>
    );
  }

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[item.dimensions.width, item.dimensions.height, item.dimensions.depth]} />
      {material}
    </mesh>
  );
}
