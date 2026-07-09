import Material from "../materials/Material";
import type { WallSegment } from "../../types";

export default function Wall({ wall }: { wall: WallSegment }) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const centerX = (wall.start.x + wall.end.x) / 2;
  const centerZ = (wall.start.z + wall.end.z) / 2;
  const height = wall.height ?? 2.9;
  const thickness = wall.thickness ?? 0.12;

  return (
    <mesh castShadow receiveShadow position={[centerX, height / 2, centerZ]} rotation={[0, -angle, 0]}>
      <boxGeometry args={[length, height, thickness]} />
      <Material
        type="white"
        color={wall.material?.color ?? "#f4f1ec"}
        roughness={wall.material?.roughness ?? 0.82}
      />
    </mesh>
  );
}
