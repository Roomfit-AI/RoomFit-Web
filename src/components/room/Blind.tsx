import type { Opening } from "../../types";

// A blind lowered to cover about 60% of the window — keeps the glass visible
// near the sill while still reading clearly as a blind, and everything stays
// inside the window's own height so it can't poke out above the wall the way
// a full height+overshoot rail previously did.
export default function Blind({ opening }: { opening: Opening }) {
  if (!opening.blind?.enabled) {
    return null;
  }

  const width = opening.dimensions.width;
  const height = opening.dimensions.height;
  const top = height / 2;
  const coverage = height * 0.6;
  const slats = Math.max(10, opening.blind.slats ?? 14);
  // opening.blind.color (set only by a demo scenario restyle — see
  // config/scenarios.ts) overrides the default wood-toned slats/rail
  // uniformly. Undefined keeps the original hardcoded look untouched.
  const railColor = opening.blind.color ?? opening.frame?.color ?? "#8c633d";
  const slatColor = opening.blind.color ?? "#7b5230";

  return (
    <group position={[0, 0, 0.045]}>
      {/* Headrail, flush with the top of the window opening. */}
      <mesh castShadow position={[0, top - 0.015, 0]}>
        <boxGeometry args={[width + 0.02, 0.03, 0.045]} />
        <meshStandardMaterial color={railColor} roughness={0.54} />
      </mesh>

      {Array.from({ length: slats }, (_, index) => (
        <mesh key={index} castShadow position={[0, top - (coverage * (index + 0.5)) / slats, 0]}>
          <boxGeometry args={[width, coverage / slats - 0.006, 0.03]} />
          <meshStandardMaterial color={slatColor} roughness={0.58} />
        </mesh>
      ))}

      {[-width / 2 + 0.01, width / 2 - 0.01].map((x) => (
        <mesh key={x} castShadow position={[x, top - coverage / 2, 0.008]}>
          <boxGeometry args={[0.035, coverage, 0.05]} />
          <meshStandardMaterial color={railColor} roughness={0.54} />
        </mesh>
      ))}
    </group>
  );
}
