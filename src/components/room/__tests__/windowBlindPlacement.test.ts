import { describe, expect, it } from "vitest";
import type { Furniture, Opening } from "../../../types";
import { resolveWindowBlindPlacements } from "../windowBlindPlacement";

const opening = (id: string, x: number, width: number): Opening => ({
  id, label: id, position: { x, z: -2 }, dimensions: { width, depth: 0.12, height: 1.2 }, rotationY: 0,
});
const blind = (id: string, x: number): Furniture => ({
  id, name: "롤 블라인드", category: "cabinet", variantId: "blind-roller",
  dimensions: { width: 1.28, depth: 0.1, height: 1.79 }, position: { x, z: -1.8 }, rotationY: 0,
  color: "#fff", material: "fabric", status: "recommended", removable: true,
});

describe("window blind placement", () => {
  it("uses the nearest unused opening and scales to its width", () => {
    const placements = resolveWindowBlindPlacements(
      { windows: [opening("left", -1, 0.8), opening("right", 1, 1.8)], height: 2.4 },
      [blind("left-blind", -0.8), blind("right-blind", 0.9)],
    );
    expect(placements.get("left-blind")?.opening.id).toBe("left");
    expect(placements.get("right-blind")?.opening.id).toBe("right");
    expect(placements.get("left-blind")?.scale[0]).toBeCloseTo(0.8 / 1.28);
    expect(placements.get("right-blind")?.scale[0]).toBeCloseTo(1.8 / 1.28);
  });

  it("does not create a free-standing placement without a window", () => {
    expect(resolveWindowBlindPlacements({ windows: [], height: 2.4 }, [blind("blind", 0)]).size).toBe(0);
  });
});
