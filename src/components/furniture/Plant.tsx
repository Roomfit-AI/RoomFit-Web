import Material from "../materials/Material";
import type { Furniture } from "../../types";

export default function Plant({ item }: { item: Furniture }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, -item.dimensions.height * 0.22, 0]}>
        <cylinderGeometry args={[0.11, 0.14, 0.2, 24]} />
        <Material type="wood" color="#9a7048" roughness={0.72} />
      </mesh>
      {Array.from({ length: 7 }, (_, index) => {
        const angle = (index / 7) * Math.PI * 2;
        return (
          <mesh
            key={index}
            castShadow
            position={[Math.cos(angle) * 0.07, 0.05 + (index % 3) * 0.035, Math.sin(angle) * 0.07]}
            rotation={[0.7, angle, 0.2]}
          >
            <boxGeometry args={[0.035, 0.22, 0.012]} />
            <Material type="accent" color={item.color} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}
