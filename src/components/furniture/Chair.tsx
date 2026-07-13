import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

// A single-seat chair — thin legs, a slim seat, one backrest panel — so it
// reads distinctly from Sofa's wide cushioned silhouette instead of looking
// like a small couch.
export default function Chair({ item }: { item: Furniture }) {
  const { width, depth, height } = item.dimensions;
  const material = materialFromConfig(item.material, item.color);

  const seatThickness = Math.min(0.04, height * 0.08);
  const seatHeightFromFloor = height * 0.52;
  const legThickness = Math.min(0.035, width * 0.07);
  const legInset = 0.025;
  const legHeight = seatHeightFromFloor - seatThickness / 2;
  const legX = width / 2 - legInset - legThickness / 2;
  const legZ = depth / 2 - legInset - legThickness / 2;
  const backThickness = Math.min(0.035, depth * 0.1);
  const backHeight = height - seatHeightFromFloor;

  const toLocalY = (fromFloor: number) => fromFloor - height / 2;

  return (
    <group>
      {/* Seat */}
      <mesh castShadow receiveShadow position={[0, toLocalY(seatHeightFromFloor - seatThickness / 2), 0]}>
        <boxGeometry args={[width, seatThickness, depth]} />
        <Material {...material} />
      </mesh>

      {/* Backrest */}
      <mesh
        castShadow
        receiveShadow
        position={[0, toLocalY(seatHeightFromFloor + backHeight / 2), -depth / 2 + backThickness / 2]}
      >
        <boxGeometry args={[width * 0.9, backHeight, backThickness]} />
        <Material {...material} />
      </mesh>

      {/* Legs */}
      {[
        [legX, legZ],
        [-legX, legZ],
        [legX, -legZ],
        [-legX, -legZ],
      ].map(([x, z], index) => (
        <mesh key={index} castShadow receiveShadow position={[x, toLocalY(legHeight / 2), z]}>
          <boxGeometry args={[legThickness, legHeight, legThickness]} />
          <Material type="wood" color="#8d6037" roughness={0.58} />
        </mesh>
      ))}
    </group>
  );
}
