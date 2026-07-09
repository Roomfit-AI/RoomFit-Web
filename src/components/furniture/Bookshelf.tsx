import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

export default function Bookshelf({ item }: { item: Furniture }) {
  const material = materialFromConfig(item.material, item.color);
  const { width, depth, height } = item.dimensions;

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <Material {...material} />
      </mesh>
      {[0.22, 0.48, 0.74].map((ratio) => (
        <mesh key={ratio} position={[0, -height / 2 + height * ratio, depth / 2 + 0.01]}>
          <boxGeometry args={[width * 0.86, 0.028, 0.035]} />
          <Material type="wood" color="#5d3f25" roughness={0.62} />
        </mesh>
      ))}
      {[-0.17, 0.08, 0.2].map((x, index) => (
        <mesh key={index} castShadow position={[x, -height * 0.05 + index * 0.22, depth / 2 + 0.04]}>
          <boxGeometry args={[0.09, 0.28, 0.06]} />
          <Material type="fabric" color={index % 2 ? "#f3e6ce" : "#d6c3a7"} roughness={0.78} />
        </mesh>
      ))}
    </group>
  );
}
