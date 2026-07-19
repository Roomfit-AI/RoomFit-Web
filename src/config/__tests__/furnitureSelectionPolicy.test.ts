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

describe("furniture selection policy", () => {
  it("blocks a desk when an existing loft bed supplies the desk function", () => {
    expect(getFurnitureSelectionBlockReason("desk", [], { furniture: [loft], windows: [] }))
      .toContain("별도의 책상");
  });

  it("blocks conflicting new selections before an API request", () => {
    expect(hasDeskLoftConflict(["desk", "bed-loft-desk"])).toBe(true);
  });

  it("does not allow a blind in a room without a window", () => {
    expect(getFurnitureSelectionBlockReason("curtain", [], { furniture: [], windows: [] }))
      .toContain("창문");
  });
});
