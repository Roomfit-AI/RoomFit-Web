import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

export default function Table({ item }: { item: Furniture }) {
  const material = materialFromConfig(item.material, item.color);
  const radius = Math.min(item.dimensions.width, item.dimensions.depth) / 2;

  if (item.geometry === "box" || item.dimensions.width !== item.dimensions.depth) {
    return (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[item.dimensions.width, item.dimensions.height, item.dimensions.depth]} />
        <Material {...material} />
      </mesh>
    );
  }

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, item.dimensions.height / 2 - 0.04, 0]}>
        <cylinderGeometry args={[radius, radius, 0.08, 48]} />
        <Material {...material} />
      </mesh>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.11, item.dimensions.height, 32]} />
        <Material type="wood" color="#8d6037" roughness={0.58} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -item.dimensions.height / 2 + 0.04, 0]}>
        <cylinderGeometry args={[radius * 0.45, radius * 0.45, 0.08, 40]} />
        <Material type="wood" color="#8d6037" roughness={0.58} />
      </mesh>
    </group>
  );
}
