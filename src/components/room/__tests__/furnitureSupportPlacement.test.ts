import { describe, expect, it } from "vitest";

import type { Furniture } from "../../../types";
import { resolveFurnitureSupportPositions } from "../furnitureSupportPlacement";

describe("resolveFurnitureSupportPositions", () => {
  it("places a centered monitor on top of a containing desk", () => {
    const desk = furniture("desk", "desk", { width: 1.4, depth: 0.7, height: 0.72 });
    const monitor = furniture("monitor", "monitor", { width: 0.55, depth: 0.2, height: 0.4 });

    expect(resolveFurnitureSupportPositions([desk, monitor]).get("monitor")?.[1])
      .toBe(desk.dimensions.height + monitor.dimensions.height / 2);
  });

  it("places a centered TV on top of a containing media console", () => {
    const console = furniture("console", "media_console", { width: 1.8, depth: 0.5, height: 0.55 });
    const tv = furniture("tv", "tv", { width: 1.2, depth: 0.12, height: 0.7 });

    expect(resolveFurnitureSupportPositions([console, tv]).get("tv")?.[1])
      .toBe(console.dimensions.height + tv.dimensions.height / 2);
  });

  it("resolves a strict pair regardless of list order", () => {
    const desk = furniture("desk", "desk", { width: 1.4, depth: 0.7, height: 0.72 });
    const monitor = furniture("monitor", "monitor", { width: 0.55, depth: 0.2, height: 0.4 });

    expect(resolveFurnitureSupportPositions([monitor, desk]).get("monitor")?.[1]).toBeCloseTo(0.92);
  });

  it("does not infer support from render categories", () => {
    const wrongSupporter = {
      ...furniture("table", "side_table", { width: 1.4, depth: 0.7, height: 0.72 }),
      category: "desk" as const,
    };
    const monitor = furniture("monitor", "monitor", { width: 0.55, depth: 0.2, height: 0.4 });

    expect(resolveFurnitureSupportPositions([wrongSupporter, monitor]).get("monitor")?.[1])
      .toBe(monitor.dimensions.height / 2);
  });

  it("keeps an oversized dependent on the floor", () => {
    const desk = furniture("desk", "desk", { width: 1, depth: 0.5, height: 0.72 });
    const monitor = furniture("monitor", "monitor", { width: 1.1, depth: 0.2, height: 0.4 });

    expect(resolveFurnitureSupportPositions([desk, monitor]).get("monitor")?.[1])
      .toBe(monitor.dimensions.height / 2);
  });

  it("rejects differing rotations whose AABBs overlap but exact footprints do not fit", () => {
    const desk = {
      ...furniture("desk", "desk", { width: 2, depth: 1, height: 0.72 }),
      rotationY: Math.PI / 4,
    };
    const monitor = {
      ...furniture("monitor", "monitor", { width: 1.8, depth: 0.2, height: 0.4 }),
      rotationY: -Math.PI / 4,
    };

    expect(resolveFurnitureSupportPositions([desk, monitor]).get("monitor")?.[1])
      .toBe(monitor.dimensions.height / 2);
  });

  it("keeps a dependent moved by 0.01m on the floor", () => {
    const desk = furniture("desk", "desk", { width: 1.4, depth: 0.7, height: 0.72 });
    const monitor = {
      ...furniture("monitor", "monitor", { width: 0.55, depth: 0.2, height: 0.4 }),
      position: { x: 0.01, z: 0 },
    };

    expect(resolveFurnitureSupportPositions([desk, monitor]).get("monitor")?.[1])
      .toBe(monitor.dimensions.height / 2);
  });

  it("keeps a dependent on the floor when its supporter is deleted", () => {
    const desk = {
      ...furniture("desk", "desk", { width: 1.4, depth: 0.7, height: 0.72 }),
      status: "deleted" as const,
    };
    const monitor = furniture("monitor", "monitor", { width: 0.55, depth: 0.2, height: 0.4 });
    const positions = resolveFurnitureSupportPositions([desk, monitor]);

    expect(positions.has("desk")).toBe(false);
    expect(positions.get("monitor")?.[1]).toBe(monitor.dimensions.height / 2);
  });
});

function furniture(
  id: string,
  sourceType: string,
  dimensions: Furniture["dimensions"],
): Furniture {
  return {
    id,
    name: id,
    category: sourceType === "desk" ? "desk" : "cabinet",
    sourceType,
    dimensions,
    position: { x: 0, z: 0 },
    rotationY: 0,
    color: "#fff",
    material: "wood",
    status: "recommended",
    removable: true,
  };
}
