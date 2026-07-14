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
// an actual floor plant instead: rest height 0 (the floor itself), a bigger
// scale, and a distinct wide-leaf silhouette (a terracotta pot with a handful
// of broad, upright fanning leaves) rather than just the tabletop vase's
// small bouquet of thin blades scaled up — a thin shape scaled up still reads
// as "sparse," not as a full, lived-in floor plant. A name containing
// "몬스테라" is a second, deliberately different floor-plant look (round
// leaf blobs on individual stems, woven-basket pot) for rooms that want two
// distinct plants rather than the same design twice.
export default function Plant({ item }: { item: Furniture }) {
  const isFloorPlant = item.name.includes("바닥") || item.name.includes("플로어");
  const isRoundLeafPlant = item.name.includes("몬스테라");
  const restHeight = isFloorPlant || isRoundLeafPlant ? 0 : 0.42;
  const scale = isFloorPlant || isRoundLeafPlant ? Math.max(1.3, item.dimensions.height / 0.42) : 1;
  const baseY = restHeight - item.dimensions.height / 2;

  if (isRoundLeafPlant) {
    const leafCount = 5;
    const potHeight = 0.28;

    return (
      <group position={[0, baseY, 0]} scale={scale}>
        <mesh castShadow receiveShadow position={[0, potHeight / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.16, potHeight, 24]} />
          <Material type="wood" color="#c9b18f" roughness={0.82} />
        </mesh>
        {Array.from({ length: leafCount }, (_, index) => {
          const angle = (index / leafCount) * Math.PI * 2 + index * 0.5;
          const lean = 0.3 + (index % 2) * 0.12;
          const stemLength = 0.24 + (index % 3) * 0.05;
          const leafSize = 0.1 + (index % 2) * 0.02;
          const dirX = Math.cos(angle);
          const dirZ = Math.sin(angle);
          const color = index % 2 === 0 ? "#2f5c33" : "#3d7040";

          return (
            <group key={index} position={[dirX * 0.05, potHeight, dirZ * 0.05]} rotation={[lean * dirZ, angle, -lean * dirX]}>
              <mesh castShadow position={[0, stemLength, 0]}>
                <boxGeometry args={[0.018, stemLength * 2, 0.018]} />
                <Material type="accent" color="#3a5a30" roughness={0.7} />
              </mesh>
              <mesh castShadow position={[0, stemLength * 2 + leafSize * 0.4, 0]} scale={[1, 0.8, 0.4]}>
                <sphereGeometry args={[leafSize, 12, 10]} />
                <Material type="accent" color={color} roughness={0.7} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

  if (isFloorPlant) {
    // Snake-plant style: mostly-upright, slender, pointed blades (a narrow
    // tip box stacked on a slightly wider base box) rather than the old
    // thick, uniformly-wide fan — thin + tapered reads as an actual plant at
    // a glance instead of a blunt green mass.
    const leafCount = 7;

    const potHeight = 0.34;

    return (
      <group position={[0, baseY, 0]} scale={scale}>
        <mesh castShadow receiveShadow position={[0, potHeight / 2, 0]}>
          <cylinderGeometry args={[0.11, 0.135, potHeight, 24]} />
          <Material type="accent" color="#b5654a" roughness={0.85} />
        </mesh>
        {Array.from({ length: leafCount }, (_, index) => {
          const angle = (index / leafCount) * Math.PI * 2 + index * 0.4;
          // Mostly upright with a slight outward lean, not splayed wide open
          // — a real snake plant's leaves grow up, only fanning a little.
          const lean = 0.1 + (index % 3) * 0.06;
          const leafLength = 0.5 + (index % 4) * 0.08;
          const baseLength = leafLength * 0.62;
          const tipLength = leafLength - baseLength;
          const color = index % 2 === 0 ? "#3a6237" : "#4d7a44";
          const dirX = Math.cos(angle);
          const dirZ = Math.sin(angle);

          return (
            <group key={index} position={[dirX * 0.03, potHeight, dirZ * 0.03]} rotation={[lean * dirZ, angle, -lean * dirX]}>
              <mesh castShadow position={[0, baseLength / 2, 0]}>
                <boxGeometry args={[0.075, baseLength, 0.018]} />
                <Material type="accent" color={color} roughness={0.75} />
              </mesh>
              <mesh castShadow position={[0, baseLength + tipLength / 2, 0]} scale={[0.55, 1, 1]}>
                <boxGeometry args={[0.075, tipLength, 0.016]} />
                <Material type="accent" color={color} roughness={0.75} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

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
