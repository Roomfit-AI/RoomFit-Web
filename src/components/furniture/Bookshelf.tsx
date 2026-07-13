import { RoundedBox } from "@react-three/drei";
import Material, { materialFromConfig } from "../materials/Material";
import type { Furniture } from "../../types";

// RoundedBoxGeometry errors if radius exceeds half of any edge, so this caps
// a desired radius to whatever the box's own thinnest dimension allows.
function safeRadius(dims: number[], desired: number): number {
  return Math.min(desired, Math.min(...dims) * 0.35);
}

const BOOK_COLORS = ["#8a4b3a", "#3d5a80", "#6b8f56", "#c9a227", "#7a4869", "#4a5a4a"];

// A real open-shelf carcass — back panel, two side panels, and horizontal
// shelf boards spanning the full depth (plus vertical dividers once the unit
// is wide enough to need more than one column) — instead of a solid box with
// a few thin decorative strips glued to its front face, which read as a
// plain block rather than a bookshelf. Each resulting compartment holds
// either a cluster of upright "books" or a small decor object.
export default function Bookshelf({ item }: { item: Furniture }) {
  const material = materialFromConfig(item.material, item.color);
  const { width, depth, height } = item.dimensions;
  const boardThickness = Math.min(0.025, depth * 0.2);
  const sideThickness = Math.min(0.03, width * 0.04);
  const backThickness = Math.min(0.02, depth * 0.15);

  const rows = Math.max(3, Math.min(6, Math.round(height / 0.42)));
  const columns = Math.max(1, Math.min(6, Math.round(width / 0.9)));
  const innerWidth = width - sideThickness * 2;
  const cellWidth = innerWidth / columns;
  const cellHeight = height / rows;

  const backDims: [number, number, number] = [width, height, backThickness];
  const sideDims: [number, number, number] = [sideThickness, height, depth];

  return (
    <group>
      {/* Back panel */}
      <RoundedBox
        args={backDims}
        radius={safeRadius(backDims, 0.015)}
        smoothness={4}
        castShadow
        receiveShadow
        position={[0, 0, -depth / 2 + backThickness / 2]}
      >
        <Material {...material} />
      </RoundedBox>

      {/* Side panels */}
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={sideDims}
          radius={safeRadius(sideDims, 0.015)}
          smoothness={4}
          castShadow
          receiveShadow
          position={[side * (width / 2 - sideThickness / 2), 0, 0]}
        >
          <Material {...material} />
        </RoundedBox>
      ))}

      {/* Horizontal shelf boards — one per row boundary, including top/bottom */}
      {Array.from({ length: rows + 1 }, (_, i) => {
        const y = -height / 2 + cellHeight * i;
        return (
          <mesh key={`shelf-${i}`} castShadow receiveShadow position={[0, y, 0]}>
            <boxGeometry args={[innerWidth, boardThickness, depth - 0.01]} />
            <Material type="wood" color="#5d3f25" roughness={0.6} />
          </mesh>
        );
      })}

      {/* Vertical dividers between columns */}
      {columns > 1 &&
        Array.from({ length: columns - 1 }, (_, i) => {
          const x = -width / 2 + sideThickness + cellWidth * (i + 1);
          return (
            <mesh key={`div-${i}`} castShadow receiveShadow position={[x, 0, 0]}>
              <boxGeometry args={[boardThickness, height, depth - 0.01]} />
              <Material type="wood" color="#5d3f25" roughness={0.6} />
            </mesh>
          );
        })}

      {/* Books / decor objects filling each compartment */}
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: columns }, (_, col) => {
          const cellCenterX = -width / 2 + sideThickness + cellWidth * (col + 0.5);
          const cellBottomY = -height / 2 + cellHeight * row + boardThickness / 2;
          const variant = (row + col) % 3;

          if (variant === 2) {
            const decorHeight = cellHeight * 0.5;
            const decorRadius = Math.min(cellWidth, depth) * 0.16;
            return (
              <mesh key={`${row}-${col}`} castShadow position={[cellCenterX, cellBottomY + decorHeight / 2, 0]}>
                <cylinderGeometry args={[decorRadius, decorRadius * 1.25, decorHeight, 16]} />
                <Material type="accent" color={row % 2 ? "#6f7d54" : "#8a6542"} roughness={0.75} />
              </mesh>
            );
          }

          const bookCount = 4 + (variant === 0 ? 1 : 0);
          const bookSlot = (cellWidth * 0.8) / bookCount;
          const bookDepth = depth * 0.6;

          return (
            <group key={`${row}-${col}`}>
              {Array.from({ length: bookCount }, (_, book) => {
                const bookHeight = cellHeight * (0.55 + ((book + row) % 3) * 0.12);
                const bookX = cellCenterX - cellWidth * 0.4 + bookSlot * (book + 0.5);
                return (
                  <mesh key={book} castShadow position={[bookX, cellBottomY + bookHeight / 2, 0]}>
                    <boxGeometry args={[Math.max(0.02, bookSlot * 0.8), bookHeight, bookDepth]} />
                    <Material
                      type="fabric"
                      color={BOOK_COLORS[(row * 3 + col + book) % BOOK_COLORS.length]}
                      roughness={0.65}
                    />
                  </mesh>
                );
              })}
            </group>
          );
        }),
      )}
    </group>
  );
}
