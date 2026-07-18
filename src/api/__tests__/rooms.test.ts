import { describe, expect, it, vi } from "vitest";
import {
  applyBackendFurnitureToLayout,
  toRoomUploadRequest,
  uploadRoomLayout,
  type BackendFurnitureApiItem,
} from "../rooms";
import { apiClient } from "../client";
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

  it("preserves a midcentury desk product and variant for the registered renderer", () => {
    const result = applyBackendFurnitureToLayout(baseLayout, [
      createBackendFurniture({
        id: "desk-midcentury-rec-1",
        label: "미드센추리 글라스 책상",
        productId: "desk-midcentury-glass-01",
        variantId: "desk-midcentury-glass",
        width: 1.75,
        depth: 0.74,
        height: 0.812,
        styleTags: ["midcentury", "modern"],
      }),
    ]);

    expect(result.furniture).toHaveLength(1);
    expect(result.furniture[0]).toMatchObject({
      id: "desk-midcentury-rec-1",
      productId: "desk-midcentury-glass-01",
      variantId: "desk-midcentury-glass",
      styleTags: ["midcentury", "modern"],
      dimensions: { width: 1.75, depth: 0.74, height: 0.812 },
    });
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

describe("toRoomUploadRequest", () => {
  it("converts a 6x6 center-origin empty room to the Backend upload contract", async () => {
    const { createCustomRoom } = await import("../../config/customRoom");
    const result = createCustomRoom({ name: "[TEST] LLM Feedback", width: "6", depth: "6" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const request = toRoomUploadRequest(result.room.layout);

    expect(request).toMatchObject({
      name: "[TEST] LLM Feedback",
      room: { width: 6, depth: 6, height: 2.4, unit: "meter" },
      openings: [],
      furniture: [],
    });
    expect(request.walls).toHaveLength(4);
    expect(request.walls[0]).toMatchObject({
      id: "north",
      start: { x: 0, z: 0 },
      end: { x: 6, z: 0 },
    });
    expect(request.walls[3]).toMatchObject({
      id: "west",
      start: { x: 0, z: 6 },
      end: { x: 0, z: 0 },
    });
  });

  it("posts the upload contract and returns the Backend roomId", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { success: true, data: { roomId: 57 }, error: null },
    });

    try {
      await expect(uploadRoomLayout(baseLayout)).resolves.toBe(57);
      expect(post).toHaveBeenCalledWith("/api/rooms/upload", toRoomUploadRequest(baseLayout));
    } finally {
      post.mockRestore();
    }
  });
});
