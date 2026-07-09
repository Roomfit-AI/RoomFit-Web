import type { Opening } from "../../types";

export default function Blind({ opening }: { opening: Opening }) {
  const slats = opening.blind?.slats ?? 16;
  const width = opening.dimensions.width;
  const height = opening.dimensions.height;

  if (!opening.blind?.enabled) {
    return null;
  }

  return (
    <group position={[0, 0, 0.045]}>
      {Array.from({ length: slats }, (_, index) => (
        <mesh key={index} castShadow position={[0, -height / 2 + (index + 0.5) * (height / slats), 0]}>
          <boxGeometry args={[width, 0.028, 0.035]} />
          <meshStandardMaterial color="#7b5230" roughness={0.58} />
        </mesh>
      ))}
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} castShadow position={[x, 0, 0.012]}>
          <boxGeometry args={[0.05, height + 0.2, 0.08]} />
          <meshStandardMaterial color={opening.frame?.color ?? "#8c633d"} roughness={0.54} />
        </mesh>
      ))}
    </group>
  );
}
