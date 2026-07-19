import { describe, expect, it } from "vitest";
import type { Furniture } from "../../types";
import {
  getFurnitureSelectionBlockReason,
  hasDeskLoftConflict,
} from "../furnitureSelectionPolicy";

const loft: Furniture = {
  id: "loft", name: "책상 수납 로프트 침대", category: "bed", variantId: "bed-loft-desk",
  dimensions: { width: 1, depth: 1, height: 1 }, position: { x: 0, z: 0 }, rotationY: 0,
  color: "#fff", material: "wood", status: "existing", removable: true,
};

const desk: Furniture = {
  id: "desk", name: "책상", category: "desk",
  dimensions: { width: 1, depth: 1, height: 1 }, position: { x: 0, z: 0 }, rotationY: 0,
  color: "#fff", material: "wood", status: "existing", removable: true,
};

describe("furniture selection policy", () => {
  it("does not block a loft bed when the existing desk is deleted", () => {
    expect(getFurnitureSelectionBlockReason("bed-loft-desk", [], {
      furniture: [{ ...desk, status: "deleted" }], windows: [],
    })).toBeNull();
  });

  it("does not block a desk when the existing loft bed is deleted", () => {
    expect(getFurnitureSelectionBlockReason("desk", [], {
      furniture: [{ ...loft, status: "deleted" }], windows: [],
    })).toBeNull();
  });

  it("blocks a loft bed when an active desk exists", () => {
    expect(getFurnitureSelectionBlockReason("bed-loft-desk", [], {
      furniture: [desk], windows: [],
    })).toContain("현재 공간에 책상이 있어");
  });

  it("blocks a desk when an active loft bed supplies the desk function", () => {
    expect(getFurnitureSelectionBlockReason("desk", [], { furniture: [loft], windows: [] }))
      .toContain("별도의 책상");
  });

  it("uses the catalog product ID only as a variant-less legacy fallback", () => {
    expect(hasDeskLoftConflict([], [{ ...loft, variantId: null, productId: "bed-loft-desk-01" }, desk])).toBe(true);
    expect(hasDeskLoftConflict([], [{ ...loft, variantId: "bed-low-platform", productId: "bed-loft-desk-01" }, desk])).toBe(false);
  });

  it("blocks conflicting new selections before an API request", () => {
    expect(hasDeskLoftConflict(["desk", "bed-loft-desk"])).toBe(true);
  });

  it("does not allow a blind in a room without a window", () => {
    expect(getFurnitureSelectionBlockReason("curtain", [], { furniture: [], windows: [] }))
      .toContain("창문");
  });
});
