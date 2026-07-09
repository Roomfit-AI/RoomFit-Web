import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

export default function Sofa({ item }: { item: Furniture }) {
  const { width, depth, height } = item.dimensions;
  const material = materialFromConfig(item.material, item.color);
  const cushionCount = width > 2 ? 3 : 1;

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, -height * 0.22, 0]}>
        <boxGeometry args={[width, height * 0.34, depth]} />
        <Material {...material} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, height * 0.12, -depth * 0.42]}>
        <boxGeometry args={[width, height * 0.7, depth * 0.16]} />
        <Material {...material} />
      </mesh>
      <mesh castShadow receiveShadow position={[-width * 0.48, height * 0.02, 0]}>
        <boxGeometry args={[width * 0.08, height * 0.52, depth]} />
        <Material {...material} />
      </mesh>
      <mesh castShadow receiveShadow position={[width * 0.48, height * 0.02, 0]}>
        <boxGeometry args={[width * 0.08, height * 0.52, depth]} />
        <Material {...material} />
      </mesh>
      {Array.from({ length: cushionCount }, (_, index) => (
        <mesh
          key={index}
          castShadow
          receiveShadow
          position={[-width * 0.28 + index * (width * 0.28), height * 0.12, depth * 0.02]}
        >
          <boxGeometry args={[width / (cushionCount + 0.45), height * 0.18, depth * 0.68]} />
          <Material type="fabric" color="#fbf7ef" roughness={0.88} />
        </mesh>
      ))}
      <mesh castShadow position={[width * 0.18, height * 0.48, -depth * 0.2]} rotation={[0.18, 0.12, 0]}>
        <boxGeometry args={[0.38, 0.28, 0.12]} />
        <Material type="fabric" color="#f7f0e4" roughness={0.9} />
      </mesh>
    </group>
  );
}
