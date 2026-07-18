import { describe, expect, it } from "vitest";

import { createCustomRoom } from "../../../config/customRoom";
import { interiorViewWallIds } from "../roomViewGeometry";

describe("interiorViewWallIds", () => {
  it("hides the two camera-facing walls when a custom room has no door", () => {
    const result = createCustomRoom({ name: "빈 방", width: "6", depth: "6" });
    if (!result.success) throw new Error("custom room fixture 생성 실패");

    const hidden = interiorViewWallIds(result.room.layout, { x: 8.1, z: 8.1 });

    expect(hidden).toEqual(new Set(["east", "south"]));
    expect(result.room.layout.floor?.size).toEqual({ width: 6, depth: 6 });
    expect(result.room.layout.furniture).toEqual([]);
    expect(result.room.layout.doors).toEqual([]);
    expect(result.room.layout.windows).toEqual([]);
  });

  it("keeps the existing door-based wall selection for sample rooms", () => {
    const result = createCustomRoom({ name: "문이 있는 방", width: "6", depth: "6" });
    if (!result.success) throw new Error("custom room fixture 생성 실패");
    const room = {
      ...result.room.layout,
      source: "SAMPLE",
      doors: [
        {
          id: "door-1",
          label: "현관",
          position: { x: 0, z: 3 },
          dimensions: { width: 0.8, depth: 0.18, height: 2.1 },
          rotationY: 0,
          wallId: "south",
        },
      ],
    };

    expect(interiorViewWallIds(room, { x: 8.1, z: 8.1 })).toEqual(new Set(["south", "west"]));
  });
});
