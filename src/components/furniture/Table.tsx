import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

export default function Table({ item }: { item: Furniture }) {
  const material = materialFromConfig(item.material, item.color);
  const radius = Math.min(item.dimensions.width, item.dimensions.depth) / 2;

  // Rectangular desks (the common case for a scanned desk) — a tabletop on
  // four legs instead of a solid block.
  if (item.geometry === "box" || item.dimensions.width !== item.dimensions.depth) {
    const { width, depth, height } = item.dimensions;
    const topThickness = Math.min(0.04, height * 0.12);
    const legInset = 0.05;
    const legThickness = 0.045;
    const legHeight = height - topThickness;
    const legX = width / 2 - legInset - legThickness / 2;
    const legZ = depth / 2 - legInset - legThickness / 2;

    return (
      <group>
        <mesh castShadow receiveShadow position={[0, height / 2 - topThickness / 2, 0]}>
          <boxGeometry args={[width, topThickness, depth]} />
          <Material {...material} />
        </mesh>
        {[
          [legX, legZ],
          [-legX, legZ],
          [legX, -legZ],
          [-legX, -legZ],
        ].map(([x, z], index) => (
          <mesh key={index} castShadow receiveShadow position={[x, -topThickness / 2, z]}>
            <boxGeometry args={[legThickness, legHeight, legThickness]} />
            <Material type="wood" color="#8d6037" roughness={0.58} />
          </mesh>
        ))}
      </group>
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
