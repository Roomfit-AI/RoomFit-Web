import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

// A made bed: frame, mattress, headboard, a duvet draped over most of the
// mattress, and a single pillow at the head (two wide pillows previously read
// as cushions; a folded throw at the foot is replaced by the duvet itself).
export default function Bed({ item }: { item: Furniture }) {
  const { width, depth, height } = item.dimensions;
  const material = materialFromConfig(item.material, item.color);
  const frameHeight = height * 0.4;
  const mattressHeight = height * 0.45;
  const duvetHeight = height * 0.22;
  const mattressTop = -height / 2 + frameHeight + mattressHeight;

  return (
    <group>
      {/* Base frame */}
      <mesh castShadow receiveShadow position={[0, -height / 2 + frameHeight / 2, 0]}>
        <boxGeometry args={[width, frameHeight, depth]} />
        <Material type="wood" color="#c8a877" roughness={0.6} />
      </mesh>

      {/* Mattress */}
      <mesh castShadow receiveShadow position={[0, -height / 2 + frameHeight + mattressHeight / 2, 0]}>
        <boxGeometry args={[width * 0.97, mattressHeight, depth * 0.97]} />
        <Material {...material} roughness={material.roughness ?? 0.85} />
      </mesh>

      {/* Headboard — inset within the bed's own depth footprint (not beyond
          it) so it can't poke through a wall placed flush against the bed. */}
      <mesh castShadow receiveShadow position={[0, height * 0.35, -depth / 2 + 0.025]}>
        <boxGeometry args={[width + 0.04, height * 1.3, 0.05]} />
        <Material type="wood" color="#c8a877" roughness={0.55} />
      </mesh>

      {/* Duvet — draped over most of the mattress, leaving room near the
          headboard for the pillow. */}
      <mesh castShadow receiveShadow position={[0, mattressTop + duvetHeight / 2, depth * 0.08]}>
        <boxGeometry args={[width * 1.02, duvetHeight, depth * 0.78]} />
        <Material type="fabric" color="#d8c9ad" roughness={0.92} />
      </mesh>

      {/* One pillow at the head. */}
      <mesh castShadow receiveShadow position={[0, mattressTop + 0.06, -depth / 2 + depth * 0.12]}>
        <boxGeometry args={[width * 0.52, 0.12, depth * 0.18]} />
        <Material type="fabric" color="#aebccb" roughness={0.9} />
      </mesh>
    </group>
  );
}
