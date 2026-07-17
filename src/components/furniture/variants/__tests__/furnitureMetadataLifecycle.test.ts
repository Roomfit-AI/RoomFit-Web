import { describe, expect, it } from "vitest";
import type { Furniture, RoomLayout } from "../../../../types";

const furniture: Furniture = {
  id: "desk-rec-1",
  name: "컴팩트 책상",
  category: "desk",
  productId: "desk-compact-01",
  variantId: "desk-compact",
  styleTags: ["minimal", "classic"],
  dimensions: { width: 1.2, depth: 0.6, height: 0.73 },
  position: { x: 0.6, z: 0 },
  rotationY: -Math.PI / 2,
  color: "#ffffff",
  geometry: "box",
  material: "wood",
  status: "recommended",
  removable: true,
};

describe("furniture catalog metadata lifecycle", () => {
  it("preserves metadata through move and rotate object spreads", () => {
    const moved = { ...furniture, position: { x: 0.8, z: 0.3 } };
    const rotated = { ...moved, rotationY: moved.rotationY + Math.PI / 2 };

    expect(rotated).toMatchObject({
      productId: "desk-compact-01",
      variantId: "desk-compact",
      styleTags: ["minimal", "classic"],
      position: { x: 0.8, z: 0.3 },
      rotationY: 0,
    });
  });

  it("preserves metadata through the RoomLayout JSON storage round trip", () => {
    const room: RoomLayout = {
      id: "api-room-1",
      name: "테스트 방",
      width: 4,
      depth: 3,
      walls: [],
      doors: [],
      windows: [],
      furniture: [furniture],
    };
    const restored = JSON.parse(JSON.stringify(room)) as RoomLayout;

    expect(restored.furniture[0]).toMatchObject({
      productId: "desk-compact-01",
      variantId: "desk-compact",
      styleTags: ["minimal", "classic"],
    });
  });
});
