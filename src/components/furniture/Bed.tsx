import { RoundedBox } from "@react-three/drei";
import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

// RoundedBoxGeometry errors if radius exceeds half of any edge, so this caps
// a desired radius to whatever the box's own thinnest dimension allows.
function safeRadius(dims: number[], desired: number): number {
  return Math.min(desired, Math.min(...dims) * 0.35);
}

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

  const frameDims: [number, number, number] = [width, frameHeight, depth];
  const mattressDims: [number, number, number] = [width * 0.97, mattressHeight, depth * 0.97];
  const headboardDims: [number, number, number] = [width + 0.04, height * 1.3, 0.05];
  const duvetDims: [number, number, number] = [width * 1.02, duvetHeight, depth * 0.78];
  const pillowDims: [number, number, number] = [width * 0.52, 0.12, depth * 0.18];

  return (
    <group>
      {/* Base frame */}
      <RoundedBox
        args={frameDims}
        radius={safeRadius(frameDims, 0.03)}
        smoothness={4}
        castShadow
        receiveShadow
        position={[0, -height / 2 + frameHeight / 2, 0]}
      >
        <Material type="wood" color="#c8a877" roughness={0.6} />
      </RoundedBox>

      {/* Mattress */}
      <RoundedBox
        args={mattressDims}
        radius={safeRadius(mattressDims, 0.05)}
        smoothness={4}
        castShadow
        receiveShadow
        position={[0, -height / 2 + frameHeight + mattressHeight / 2, 0]}
      >
        <Material {...material} roughness={material.roughness ?? 0.85} />
      </RoundedBox>

      {/* Headboard — inset within the bed's own depth footprint (not beyond
          it) so it can't poke through a wall placed flush against the bed. */}
      <RoundedBox
        args={headboardDims}
        radius={safeRadius(headboardDims, 0.025)}
        smoothness={4}
        castShadow
        receiveShadow
        position={[0, height * 0.35, -depth / 2 + 0.025]}
      >
        <Material type="wood" color="#c8a877" roughness={0.55} />
      </RoundedBox>

      {/* Duvet — draped over most of the mattress, leaving room near the
          headboard for the pillow. */}
      <RoundedBox
        args={duvetDims}
        radius={safeRadius(duvetDims, 0.05)}
        smoothness={4}
        castShadow
        receiveShadow
        position={[0, mattressTop + duvetHeight / 2, depth * 0.08]}
      >
        <Material type="fabric" color="#d8c9ad" roughness={0.92} />
      </RoundedBox>

      {/* One pillow at the head. */}
      <RoundedBox
        args={pillowDims}
        radius={safeRadius(pillowDims, 0.04)}
        smoothness={4}
        castShadow
        receiveShadow
        position={[0, mattressTop + 0.06, -depth / 2 + depth * 0.12]}
      >
        <Material type="fabric" color="#aebccb" roughness={0.9} />
      </RoundedBox>
    </group>
  );
}
