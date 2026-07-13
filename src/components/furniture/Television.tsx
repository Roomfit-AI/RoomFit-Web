import Material from "../materials/Material";
import type { Furniture } from "../../types";

// A wall-mounted flat panel: thin matte bezel, an inset glossy screen with a
// soft diagonal reflection highlight, and a slim mount bracket behind it —
// the previous version was two near-black boxes (#0d0d0d / #161616) barely
// offset from each other, which at a glance just read as one plain black box.
//
// FurnitureMesh always centers an item's group at floor + dimensions.height/2
// (there's no separate "mounting height" field), so a TV item's own height
// doubles as its full floor-to-top footprint. To actually read as
// wall-mounted *above* a low TV stand next to it, rather than a panel sitting
// on the floor behind the stand, the panel itself only fills the upper
// portion of that footprint — the bottom ~34% is left empty, roughly
// matching a typical TV stand's height, so the two can be positioned at the
// same x/z and stack visually.
export default function Television({ item }: { item: Furniture }) {
  const { width, height, depth } = item.dimensions;
  const bezelDepth = Math.max(0.025, depth * 0.5);
  const screenInset = 0.05;
  const standClearance = height * 0.34;
  const panelHeight = height * 0.61;
  const panelCenterY = -height / 2 + standClearance + panelHeight / 2;

  return (
    <group>
      {/* Bezel / body — a dark graphite rather than near-black so it reads
          as a distinct frame instead of merging with the screen. */}
      <mesh castShadow receiveShadow position={[0, panelCenterY, 0]}>
        <boxGeometry args={[width, panelHeight, bezelDepth]} />
        <Material type="glass" color="#232323" roughness={0.4} metalness={0.15} />
      </mesh>

      {/* Screen — a cooler, glossier dark blue-black so it visibly separates
          from the matte bezel around it. */}
      <mesh position={[0, panelCenterY, bezelDepth / 2 + 0.004]}>
        <boxGeometry args={[width - screenInset, panelHeight - screenInset, 0.008]} />
        <Material type="glass" color="#0c141d" roughness={0.06} metalness={0.35} />
      </mesh>

      {/* Soft diagonal reflection glint across the glass. */}
      <mesh position={[-width * 0.12, panelCenterY + panelHeight * 0.1, bezelDepth / 2 + 0.009]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[width * 0.18, panelHeight * 1.15, 0.002]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>

      {/* Slim wall-mount bracket, mostly hidden behind the panel. */}
      <mesh position={[0, panelCenterY, -bezelDepth / 2 - 0.015]}>
        <boxGeometry args={[width * 0.22, panelHeight * 0.5, 0.03]} />
        <Material type="metal" color="#1c1c1c" roughness={0.5} metalness={0.6} />
      </mesh>
    </group>
  );
}
