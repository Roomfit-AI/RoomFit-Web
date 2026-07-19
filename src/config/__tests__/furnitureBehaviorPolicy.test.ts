import { describe, expect, it } from "vitest";
import {
  getThemeColor,
  getThemeTarget,
  resolveFurnitureCollisionMode,
  THEME_PALETTES,
} from "../furnitureBehaviorPolicy";

describe("furniture behavior policy", () => {
  it("uses a multi-colour palette for every selectable tone", () => {
    for (const palette of Object.values(THEME_PALETTES)) {
      expect(palette.primary.length).toBeGreaterThanOrEqual(2);
      expect(palette.secondary.length).toBeGreaterThanOrEqual(2);
      expect(palette.accent.length).toBeGreaterThanOrEqual(2);
      expect(new Set([...palette.primary, ...palette.secondary, ...palette.accent]).size).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps palette assignment deterministic and part-specific", () => {
    const pillow = getThemeTarget("bed-fabric-headboard", "pillow-left")!;
    const blanket = getThemeTarget("bed-fabric-headboard", "blanket")!;
    expect(getThemeColor("green", pillow, "bed:pillow")).toBe(getThemeColor("green", pillow, "bed:pillow"));
    expect(getThemeColor("green", pillow, "bed:pillow")).not.toBe(getThemeColor("green", blanket, "bed:blanket"));
    expect(getThemeTarget("bed-fabric-headboard", "mattress")).toBeNull();
  });

  it("treats rugs as floor overlays without changing desk-chair policy", () => {
    expect(resolveFurnitureCollisionMode("rug-rectangular", "rug")).toBe("FLOOR_OVERLAY");
    expect(resolveFurnitureCollisionMode("chair-basic", "chair")).toBe("SOLID");
  });
});
