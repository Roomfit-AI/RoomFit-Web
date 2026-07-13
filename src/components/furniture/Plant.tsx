import Material from "../materials/Material";
import type { Furniture } from "../../types";

// Most uses of this component are a tabletop vase (see the "화병"/plant
// match in FurnitureRenderer) — but FurnitureMesh has no notion of "resting
// surface," it always centers a group at floor + height/2, the same
// convention every floor-standing item uses. That previously put the pot's
// bottom barely above the floor, entirely inside the coffee table's own
// 0.42m-tall volume instead of on top of it. `restHeight - height/2` cancels
// that floor-relative centering and re-anchors local y=0 to the resting
// surface's real height instead, so the pot's bottom actually lands there.
//
// A name containing "바닥"/"플로어" (floor/floor-standing) switches this to
// an actual floor plant instead: rest height 0 (the floor itself) and a
// bigger scale, since the geometry below is otherwise a fixed small
// tabletop-vase size regardless of the item's own declared dimensions.
export default function Plant({ item }: { item: Furniture }) {
  const isFloorPlant = item.name.includes("바닥") || item.name.includes("플로어");
  const restHeight = isFloorPlant ? 0 : 0.42;
  const scale = isFloorPlant ? Math.max(1.6, item.dimensions.height / 0.42) : 1;
  const baseY = restHeight - item.dimensions.height / 2;

  return (
    <group position={[0, baseY, 0]} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.11, 0.14, 0.2, 24]} />
        <Material type="wood" color="#9a7048" roughness={0.72} />
      </mesh>
      {Array.from({ length: 7 }, (_, index) => {
        const angle = (index / 7) * Math.PI * 2;
        return (
          <mesh
            key={index}
            castShadow
            position={[Math.cos(angle) * 0.07, 0.26 + (index % 3) * 0.035, Math.sin(angle) * 0.07]}
            rotation={[0.7, angle, 0.2]}
          >
            <boxGeometry args={[0.035, 0.22, 0.012]} />
            <Material type="accent" color={item.color} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}
