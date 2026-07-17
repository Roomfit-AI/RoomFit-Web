import { describe, expect, it } from "vitest";
import {
  applyBackendFurnitureToLayout,
  type BackendFurnitureApiItem,
} from "../rooms";
import type { RoomLayout } from "../../types";

const baseLayout: RoomLayout = {
  id: "api-room-1",
  name: "테스트 방",
  width: 4,
  depth: 3,
  height: 2.4,
  walls: [],
  doors: [],
  windows: [],
  furniture: [],
};

function createBackendFurniture(
  overrides: Partial<BackendFurnitureApiItem> = {},
): BackendFurnitureApiItem {
  return {
    id: "desk-rec-1",
    type: "desk",
    label: "컴팩트 책상",
    width: 1.2,
    depth: 0.6,
    height: 0.73,
    position: { x: 2.6, z: 1.5 },
    rotation: 90,
    status: "RECOMMENDED",
    productId: "desk-compact-01",
    variantId: "desk-compact",
    styleTags: ["minimal", "classic"],
    ...overrides,
  };
}

describe("applyBackendFurnitureToLayout", () => {
  it("preserves catalog metadata and existing coordinate conversions", () => {
    const backendFurniture = createBackendFurniture();
    const result = applyBackendFurnitureToLayout(baseLayout, [backendFurniture]);
    const furniture = result.furniture[0];

    expect(furniture).toMatchObject({
      productId: "desk-compact-01",
      variantId: "desk-compact",
      styleTags: ["minimal", "classic"],
      dimensions: { width: 1.2, depth: 0.6, height: 0.73 },
      rotationY: -Math.PI / 2,
    });
    expect(furniture.position.x).toBeCloseTo(0.6);
    expect(furniture.position.z).toBeCloseTo(0);
    expect(furniture.styleTags).not.toBe(backendFurniture.styleTags);
  });

  it("preserves a null variantId", () => {
    const result = applyBackendFurnitureToLayout(baseLayout, [
      createBackendFurniture({ productId: null, variantId: null, styleTags: [] }),
    ]);

    expect(result.furniture[0]).toMatchObject({
      productId: null,
      variantId: null,
      styleTags: [],
    });
  });

  it("preserves an unknown variantId for render-time fallback", () => {
    const result = applyBackendFurnitureToLayout(baseLayout, [
      createBackendFurniture({ variantId: "future-desk-variant" }),
    ]);

    expect(result.furniture[0].variantId).toBe("future-desk-variant");
  });

  it("uses the same metadata-preserving mapper for a subsequent feedback result", () => {
    const recommended = applyBackendFurnitureToLayout(baseLayout, [createBackendFurniture()]);
    const feedback = applyBackendFurnitureToLayout(recommended, [
      createBackendFurniture({ position: { x: 2.8, z: 1.8 }, rotation: 180 }),
    ]);

    expect(feedback.furniture[0]).toMatchObject({
      productId: "desk-compact-01",
      variantId: "desk-compact",
      styleTags: ["minimal", "classic"],
      rotationY: -Math.PI,
    });
    expect(feedback.furniture[0].position.x).toBeCloseTo(0.8);
    expect(feedback.furniture[0].position.z).toBeCloseTo(0.3);
  });
});
