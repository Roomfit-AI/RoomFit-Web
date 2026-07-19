import { describe, expect, it } from "vitest";

import type { Furniture, RoomLayout } from "../../types";
import {
  assertFurnitureAdditionAllowed,
  evaluateFurnitureAdditionLimit,
  FurnitureAdditionLimitError,
  MAX_ACTIVE_FURNITURE,
  MAX_NEW_ADDITIONS,
} from "../furnitureAdditionPolicy";

const EIGHT_SELECTIONS = [
  "bed", "sofa", "desk", "nightstand", "side-table", "desk-chair", "bookshelf", "plant",
];

describe("furniture addition policy", () => {
  it("uses the shared eight-new and twelve-active limits", () => {
    expect(MAX_NEW_ADDITIONS).toBe(8);
    expect(MAX_ACTIVE_FURNITURE).toBe(12);
    expect(evaluateFurnitureAdditionLimit(room(0), EIGHT_SELECTIONS)).toMatchObject({
      activeFurnitureCount: 0,
      newAdditionCount: 8,
      finalActiveFurnitureCount: 8,
      allowed: true,
    });
    expect(evaluateFurnitureAdditionLimit(room(4), EIGHT_SELECTIONS)).toMatchObject({
      finalActiveFurnitureCount: 12,
      allowed: true,
    });
  });

  it("rejects existing five plus eight, existing twelve plus one, and nine new", () => {
    expect(() => assertFurnitureAdditionAllowed(room(5), EIGHT_SELECTIONS))
      .toThrow(FurnitureAdditionLimitError);
    expect(() => assertFurnitureAdditionAllowed(room(12), ["bed"]))
      .toThrow(FurnitureAdditionLimitError);
    expect(() => assertFurnitureAdditionAllowed(room(0), [...EIGHT_SELECTIONS, "rug"]))
      .toThrow(FurnitureAdditionLimitError);
  });

  it("counts only active furniture in the current layout", () => {
    const current = room(4);
    current.furniture.push(...Array.from({ length: 20 }, (_, index) => item(`deleted-${index}`, "deleted")));

    expect(evaluateFurnitureAdditionLimit(current, EIGHT_SELECTIONS)).toMatchObject({
      activeFurnitureCount: 4,
      finalActiveFurnitureCount: 12,
      allowed: true,
    });
  });
});

function room(activeCount: number): RoomLayout {
  return {
    id: "current-room",
    name: "Current Room",
    width: 6,
    depth: 6,
    walls: [],
    doors: [],
    windows: [],
    furniture: Array.from({ length: activeCount }, (_, index) => item(`active-${index}`, "existing")),
  };
}

function item(id: string, status: Furniture["status"]): Furniture {
  return {
    id,
    name: id,
    category: "desk",
    dimensions: { width: 1, depth: 0.5, height: 0.7 },
    position: { x: 0, z: 0 },
    rotationY: 0,
    color: "#fff",
    material: "wood",
    status,
    removable: true,
  };
}
