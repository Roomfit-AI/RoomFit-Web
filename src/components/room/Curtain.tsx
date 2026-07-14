import type { Opening } from "../../types";

// A soft fabric curtain — two gathered panels pulled to the sides, mostly
// clearing the glass — used instead of Blind.tsx only when a scenario
// explicitly switches an opening's blind.type to "curtain" (see
// config/scenarios.ts). Deliberately a separate component rather than a
// branch inside Blind.tsx, so the default wood-blind rendering is never
// touched by a scenario applying this.
export default function Curtain({ opening }: { opening: Opening }) {
  if (!opening.blind?.enabled) {
    return null;
  }

  const width = opening.dimensions.width;
  const height = opening.dimensions.height;
  const top = height / 2;
  const railColor = opening.frame?.color ?? "#8c633d";
  const fabricColor = opening.blind.color ?? "#e8e4da";
  const panelWidth = width * 0.2;
  const panelHeight = height * 0.96;

  return (
    <group position={[0, 0, 0.045]}>
      {/* Rail, flush with the top of the window opening. */}
      <mesh castShadow position={[0, top - 0.01, 0]}>
        <boxGeometry args={[width + 0.06, 0.02, 0.03]} />
        <meshStandardMaterial color={railColor} roughness={0.5} metalness={0.2} />
      </mesh>

      {/* Two panels gathered to the sides, each built from a few overlapping
          folds so it reads as draped fabric instead of a flat slab. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (width / 2 - panelWidth * 0.6), top - panelHeight / 2 - 0.015, 0]}>
          {[0, 1, 2].map((fold) => (
            <mesh key={fold} castShadow position={[side * fold * panelWidth * 0.3, 0, fold * 0.006]}>
              <boxGeometry args={[panelWidth * 0.4, panelHeight, 0.025]} />
              <meshStandardMaterial color={fabricColor} roughness={0.88} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
