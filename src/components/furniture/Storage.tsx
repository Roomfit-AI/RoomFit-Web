import { RoundedBox } from "@react-three/drei";
import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

// RoundedBoxGeometry errors if radius exceeds half of any edge, so this caps
// a desired radius to whatever the box's own thinnest dimension allows.
function safeRadius(dims: number[], desired: number): number {
  return Math.min(desired, Math.min(...dims) * 0.35);
}

// Generic storage furniture ("수납장" from a scan can be anything from a low
// dresser to a tall wardrobe). Taller pieces get door panel(s); shorter ones
// get stacked drawer fronts — either way it reads as storage rather than a
// plain block.
export default function Storage({ item }: { item: Furniture }) {
  const { width, depth, height } = item.dimensions;
  const material = materialFromConfig(item.material, item.color);
  const isTall = height > 1.1;
  const doorCount = isTall && width > 0.9 ? 2 : 1;
  const drawerCount = Math.max(2, Math.min(4, Math.round(height / 0.18)));

  const bodyDims: [number, number, number] = [width, height, depth];

  return (
    <group>
      <RoundedBox args={bodyDims} radius={safeRadius(bodyDims, 0.025)} smoothness={4} castShadow receiveShadow>
        <Material {...material} />
      </RoundedBox>

      {isTall
        ? Array.from({ length: doorCount }, (_, index) => {
            const doorWidth = width / doorCount - 0.02;
            const x = doorCount === 2 ? (index === 0 ? -width / 4 : width / 4) : 0;
            const handleX = doorCount === 2 ? (index === 0 ? doorWidth / 2 - 0.04 : -(doorWidth / 2 - 0.04)) : doorWidth / 2 - 0.04;

            return (
              <group key={index} position={[x, 0, depth / 2 + 0.007]}>
                <mesh receiveShadow>
                  <boxGeometry args={[doorWidth, height - 0.06, 0.014]} />
                  <Material type="wood" color={material.color} roughness={0.5} />
                </mesh>
                <mesh position={[handleX, 0, 0.014]} castShadow>
                  <boxGeometry args={[0.014, 0.1, 0.014]} />
                  <meshStandardMaterial color="#d8c8a0" roughness={0.3} metalness={0.5} />
                </mesh>
              </group>
            );
          })
        : Array.from({ length: drawerCount }, (_, index) => {
            const drawerHeight = (height - 0.04) / drawerCount - 0.02;
            const y = height / 2 - 0.02 - drawerHeight / 2 - index * (drawerHeight + 0.02);

            return (
              <group key={index} position={[0, y, depth / 2 + 0.007]}>
                <mesh receiveShadow>
                  <boxGeometry args={[width - 0.05, drawerHeight, 0.014]} />
                  <Material type="wood" color={material.color} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0, 0.014]} castShadow>
                  <boxGeometry args={[width * 0.28, 0.014, 0.014]} />
                  <meshStandardMaterial color="#d8c8a0" roughness={0.3} metalness={0.5} />
                </mesh>
              </group>
            );
          })}
    </group>
  );
}
