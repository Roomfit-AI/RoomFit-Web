import Material from "../materials/Material";
import type { Furniture } from "../../types";

export default function Lamp({ item }: { item: Furniture }) {
  const height = item.dimensions.height;

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, -height / 2 + 0.035, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.07, 32]} />
        <Material type="metal" color="#211d19" roughness={0.42} metalness={0.45} />
      </mesh>
      <mesh castShadow position={[0, -0.05, 0]} rotation={[0, 0, -0.18]}>
        <cylinderGeometry args={[0.025, 0.025, height * 0.92, 24]} />
        <Material type="metal" color="#211d19" roughness={0.42} metalness={0.45} />
      </mesh>
      <mesh castShadow position={[0.18, height * 0.38, -0.02]}>
        <sphereGeometry args={[0.13, 24, 16]} />
        <meshStandardMaterial color="#f7e8bd" emissive="#f4d47d" emissiveIntensity={0.55} roughness={0.42} />
      </mesh>
    </group>
  );
}
