import type { Opening } from "../../types";

// The wall already has a real cut for this opening (see Wall.tsx) — the casing
// here is deliberately close to the wall's own color so the opening still
// reads as "a doorway in a white wall," with the door leaf (wood-toned) set
// back within it. Every layer is centered on z=0 (rather than offset toward
// one face) and the handle is mirrored on both sides, so the door reads the
// same whether you're looking at it from inside or outside the room.
//
// `wallThickness` sizes the casing depth to always exceed the actual wall
// it's cut into (by a fixed 2cm) — a fixed 0.05 casing depth used to sit
// entirely recessed inside a thicker wall (default/real walls run
// 0.1-0.14m), reading as the door sunk deep into a slot rather than a door
// flush with the wall faces.
export default function Door({ opening, wallThickness = 0.12 }: { opening: Opening; wallThickness?: number }) {
  const width = opening.dimensions.width;
  const height = opening.dimensions.height;
  const handleX = width / 2 - 0.09;
  const casingDepth = wallThickness + 0.02;
  const leafDepth = casingDepth * 0.72;
  const panelDepth = casingDepth * 0.9;

  return (
    <group position={[opening.position.x, height / 2, opening.position.z]} rotation={[0, opening.rotationY, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[width + 0.05, height + 0.04, casingDepth]} />
        <meshStandardMaterial color="#f2ede2" roughness={0.75} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[width - 0.04, height - 0.04, leafDepth]} />
        <meshStandardMaterial color="#a8794f" roughness={0.5} />
      </mesh>
      <mesh>
        <boxGeometry args={[width - 0.16, height - 0.16, panelDepth]} />
        <meshStandardMaterial color="#93683f" roughness={0.55} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[handleX, 0, side * (leafDepth / 2 + 0.006)]} castShadow>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color="#c9b48a" roughness={0.55} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}
