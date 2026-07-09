import Blind from "./Blind";
import type { Opening } from "../../types";

export default function Window({ opening }: { opening: Opening }) {
  return (
    <group position={[opening.position.x, 1.45, opening.position.z]} rotation={[0, opening.rotationY, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[opening.dimensions.width + 0.18, opening.dimensions.height + 0.18, 0.07]} />
        <meshStandardMaterial color={opening.frame?.color ?? "#8a623d"} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.018]}>
        <boxGeometry args={[opening.dimensions.width, opening.dimensions.height, 0.032]} />
        <meshPhysicalMaterial
          color="#f8f2e7"
          roughness={0.04}
          transmission={opening.glass?.transmission ?? 0.25}
          opacity={opening.glass?.opacity ?? 0.26}
          transparent
        />
      </mesh>
      <Blind opening={opening} />
    </group>
  );
}
