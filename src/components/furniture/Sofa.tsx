import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

// Blends toward a fixed warm terracotta accent rather than just lightening
// the base color — a same-hue-but-lighter cushion reads as one flat block of
// color (which is exactly what made a dark sofa look like an undifferentiated
// black mass). Mixing toward a warm accent gives the cushions their own
// character while still harmonizing with whatever base color the sofa has.
const ACCENT = { r: 0xc9, g: 0x8a, b: 0x55 };

function mixToAccent(hex: string, t: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const channel = (shift: number, accent: number) => {
    const base = (num >> shift) & 0xff;
    return Math.round(base + (accent - base) * t);
  };
  const r = channel(16, ACCENT.r);
  const g = channel(8, ACCENT.g);
  const b = channel(0, ACCENT.b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export default function Sofa({ item }: { item: Furniture }) {
  const { width, depth, height } = item.dimensions;
  const material = materialFromConfig(item.material, item.color);
  const cushionCount = width > 2 ? 3 : 1;
  const cushionColor = mixToAccent(material.color, 0.5);
  const pillowColor = mixToAccent(material.color, 0.75);
  const legHeight = Math.min(0.1, height * 0.14);

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, -height * 0.22, 0]}>
        <boxGeometry args={[width, height * 0.34, depth]} />
        <Material {...material} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, height * 0.12, -depth * 0.42]}>
        <boxGeometry args={[width, height * 0.7, depth * 0.16]} />
        <Material {...material} />
      </mesh>
      <mesh castShadow receiveShadow position={[-width * 0.48, height * 0.02, 0]}>
        <boxGeometry args={[width * 0.08, height * 0.52, depth]} />
        <Material {...material} />
      </mesh>
      <mesh castShadow receiveShadow position={[width * 0.48, height * 0.02, 0]}>
        <boxGeometry args={[width * 0.08, height * 0.52, depth]} />
        <Material {...material} />
      </mesh>
      {Array.from({ length: cushionCount }, (_, index) => (
        <mesh
          key={index}
          castShadow
          receiveShadow
          position={[-width * 0.28 + index * (width * 0.28), height * 0.12, depth * 0.02]}
        >
          <boxGeometry args={[width / (cushionCount + 0.45), height * 0.18, depth * 0.68]} />
          <Material type="fabric" color={cushionColor} roughness={0.8} />
        </mesh>
      ))}
      <mesh castShadow position={[width * 0.18, height * 0.48, -depth * 0.2]} rotation={[0.18, 0.12, 0]}>
        <boxGeometry args={[0.38, 0.28, 0.12]} />
        <Material type="fabric" color={pillowColor} roughness={0.85} />
      </mesh>

      {/* Slim block legs — a low-profile, modern silhouette instead of the
          body sitting flush on the floor. */}
      {[
        [-width * 0.42, -depth * 0.36],
        [width * 0.42, -depth * 0.36],
        [-width * 0.42, depth * 0.36],
        [width * 0.42, depth * 0.36],
      ].map(([x, z], index) => (
        <mesh key={index} castShadow receiveShadow position={[x, -height * 0.42, z]}>
          <boxGeometry args={[0.05, legHeight, 0.05]} />
          <Material type="metal" color="#1a1a1a" roughness={0.4} metalness={0.55} />
        </mesh>
      ))}
    </group>
  );
}
