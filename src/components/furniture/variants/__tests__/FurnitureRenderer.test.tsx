import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import FurnitureRenderer from "../../FurnitureRenderer";
import Table from "../../Table";
import type { Furniture } from "../../../../types";
import { FurnitureVariantRenderer } from "../FurnitureVariantRenderer";

function createDesk(overrides: Partial<Furniture> = {}): Furniture {
  return {
    id: "desk-rec-1",
    name: "컴팩트 책상",
    category: "desk",
    productId: "desk-compact-01",
    variantId: "desk-compact",
    styleTags: ["minimal", "classic"],
    dimensions: { width: 1.2, depth: 0.6, height: 0.73 },
    position: { x: 0, z: 0 },
    rotationY: -Math.PI / 2,
    color: "#ffffff",
    geometry: "box",
    material: "wood",
    status: "recommended",
    removable: true,
    ...overrides,
  };
}

describe("FurnitureRenderer variant adapter", () => {
  it("renders a registered variant with only the floor-center Y correction", () => {
    const element = FurnitureRenderer({ item: createDesk() }) as ReactElement<{
      layoutPosition?: [number, number, number];
      layoutRotation?: [number, number, number];
      scale?: unknown;
    }>;

    expect(element.type).toBe(FurnitureVariantRenderer);
    expect(element.props.layoutPosition).toEqual([0, -0.365, 0]);
    expect(element.props.layoutRotation).toBeUndefined();
    expect(element.props.scale).toBeUndefined();
  });

  it("keeps the legacy renderer for furniture without a variantId", () => {
    const element = FurnitureRenderer({ item: createDesk({ variantId: null }) });

    expect(element.type).toBe(Table);
  });

  it("keeps the legacy renderer for an unknown variantId", () => {
    const element = FurnitureRenderer({ item: createDesk({ variantId: "unknown-renderer-test" }) });

    expect(element.type).toBe(Table);
  });
});
