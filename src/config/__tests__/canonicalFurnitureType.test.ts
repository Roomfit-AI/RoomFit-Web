import { describe, expect, it } from "vitest";
import catalogDocument from "../../data/furniture/catalog.json";
import {
  CANONICAL_FURNITURE_TYPES,
  normalizeCanonicalFurnitureType,
} from "../canonicalFurnitureType";

describe("canonical furniture types", () => {
  it("exposes all 21 incoming catalog types", () => {
    expect(CANONICAL_FURNITURE_TYPES).toEqual([
      "bed",
      "bookshelf",
      "curtain_blind",
      "desk",
      "desk_chair",
      "drawer_chest",
      "full_length_mirror",
      "hanger",
      "media_console",
      "monitor",
      "mood_lamp",
      "multi_table",
      "nightstand",
      "partition_shelf",
      "plant",
      "rug",
      "side_table",
      "sofa",
      "sofa_bed",
      "tv",
      "wardrobe",
    ]);
    expect(new Set(CANONICAL_FURNITURE_TYPES)).toEqual(
      new Set(catalogDocument.products.map((product) => product.furnitureType)),
    );
  });

  it("normalizes generated codes and safe legacy aliases", () => {
    expect(normalizeCanonicalFurnitureType("MOOD_LAMP")).toBe("mood_lamp");
    expect(normalizeCanonicalFurnitureType("lamp")).toBe("mood_lamp");
    expect(normalizeCanonicalFurnitureType("lighting")).toBe("mood_lamp");
    expect(normalizeCanonicalFurnitureType("side table")).toBe("side_table");
    expect(normalizeCanonicalFurnitureType("bedside table")).toBe("nightstand");
    expect(normalizeCanonicalFurnitureType("tvStand")).toBe("media_console");
  });

  it("does not collapse distinct storage families or invent unknown types", () => {
    expect(normalizeCanonicalFurnitureType("bookshelf")).toBe("bookshelf");
    expect(normalizeCanonicalFurnitureType("hanger")).toBe("hanger");
    expect(normalizeCanonicalFurnitureType("wardrobe")).toBe("wardrobe");
    expect(normalizeCanonicalFurnitureType("storage")).toBeNull();
    expect(normalizeCanonicalFurnitureType("future-unknown")).toBeNull();
  });
});
