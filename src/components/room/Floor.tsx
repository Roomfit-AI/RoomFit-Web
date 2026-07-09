import Material from "../materials/Material";
import type { RoomLayout } from "../../types";

export default function Floor({ room }: { room: RoomLayout }) {
  const width = room.floor?.size.width ?? room.width;
  const depth = room.floor?.size.depth ?? room.depth;
  const color = room.floor?.material.color ?? "#eee6dc";
  const roughness = room.floor?.material.roughness ?? 0.86;

  return (
    <group>
      <mesh receiveShadow position={[0, -0.025, 0]}>
        <boxGeometry args={[width, 0.05, depth]} />
        <Material type="wood" color={color} roughness={roughness} />
      </mesh>
      <FloorLines width={width} depth={depth} />
    </group>
  );
}

function FloorLines({ width, depth }: { width: number; depth: number }) {
  const lines = Array.from({ length: 8 }, (_, index) => index);

  return (
    <group>
      {lines.map((index) => (
        <mesh key={`x-${index}`} position={[-width / 2 + index * (width / 7), 0.004, 0]}>
          <boxGeometry args={[0.012, 0.006, depth]} />
          <meshBasicMaterial color="#ded5ca" transparent opacity={0.42} />
        </mesh>
      ))}
      {lines.map((index) => (
        <mesh key={`z-${index}`} position={[0, 0.005, -depth / 2 + index * (depth / 7)]}>
          <boxGeometry args={[width, 0.006, 0.012]} />
          <meshBasicMaterial color="#ded5ca" transparent opacity={0.34} />
        </mesh>
      ))}
    </group>
  );
}
