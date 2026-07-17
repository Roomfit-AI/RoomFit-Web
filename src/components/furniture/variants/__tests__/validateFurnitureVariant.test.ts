import { describe, expect, it } from "vitest";
import type {
  FurnitureLifestyleTag,
  FurnitureStyleTag,
} from "../types";
import { validateFurnitureVariant } from "../validateFurnitureVariant";
import { makeTestMaterialCatalog, makeValidFurnitureVariant } from "./fixtures";

describe("validateFurnitureVariant", () => {
  it("accepts a valid schema 1.0 variant and defaults omitted rotation", () => {
    const result = validateFurnitureVariant(makeValidFurnitureVariant(), makeTestMaterialCatalog());

    expect(result.schemaVersion).toBe("1.0");
    expect(result.materials).toEqual(["testWhite", "testMetal"]);
    expect(result.parts[0].material).toBe("testWhite");
    expect(result.parts[0].rotation).toEqual([0, 0, 0]);
    expect(result.purchaseUrl).toBe("https://example.com/products/test-desk");
  });

  it("rejects duplicate material preset names", () => {
    const variant = makeValidFurnitureVariant();
    variant.materials.push("testWhite");

    expectInvalid(variant, 'Duplicate material "testWhite"');
  });

  it("rejects the schema 1.0 slot mapping shape", () => {
    const variant = makeValidFurnitureVariant();
    (variant as unknown as { materials: unknown }).materials = { surface: "testWhite" };

    expectInvalid(variant, "materials must be a non-empty array");
  });

  it("rejects an unsupported schemaVersion", () => {
    const variant = makeValidFurnitureVariant();
    variant.schemaVersion = "2.0" as "1.0";

    expectInvalid(variant, "schemaVersion");
  });

  it("rejects duplicate part IDs", () => {
    const variant = makeValidFurnitureVariant();
    variant.parts[1].id = variant.parts[0].id;

    expectInvalid(variant, "Duplicate part id");
  });

  it("rejects non-positive dimensions", () => {
    const variant = makeValidFurnitureVariant();
    variant.dimensions.width = 0;

    expectInvalid(variant, "dimensions.width");
  });

  it("rejects non-finite positions and rotations", () => {
    const invalidPosition = makeValidFurnitureVariant();
    invalidPosition.parts[0].position[1] = Number.NaN;
    expectInvalid(invalidPosition, "position");

    const invalidRotation = makeValidFurnitureVariant();
    invalidRotation.parts[0].rotation = [0, Number.POSITIVE_INFINITY, 0];
    expectInvalid(invalidRotation, "rotation");
  });

  it("rejects a material not declared by the variant", () => {
    const variant = makeValidFurnitureVariant();
    variant.parts[0].material = "woodSoft";

    expect(() => validateFurnitureVariant(variant, makeTestMaterialCatalog())).toThrowError(
      'Material "woodSoft" referenced by variant "test-desk-compact", part "top" is not declared in variant.materials.',
    );
  });

  it("rejects a declared material missing from the global catalog", () => {
    const variant = makeValidFurnitureVariant();
    variant.materials.push("woodSoft");

    expect(() => validateFurnitureVariant(variant, makeTestMaterialCatalog())).toThrowError(
      'Material preset "woodSoft" declared by variant "test-desk-compact" does not exist in the global material catalog.',
    );
  });

  it("rejects unsupported style and lifestyle tags", () => {
    const invalidStyle = makeValidFurnitureVariant();
    invalidStyle.styleTags = ["industrial" as FurnitureStyleTag];
    expectInvalid(invalidStyle, "styleTags");

    const invalidLifestyle = makeValidFurnitureVariant();
    invalidLifestyle.lifestyleTags = ["DINING" as FurnitureLifestyleTag];
    expectInvalid(invalidLifestyle, "lifestyleTags");
  });

  it.each([
    "http://example.com/products/desk",
    "ftp://example.com/products/desk",
    "javascript:alert(1)",
    "file:///tmp/desk.json",
    "/products/desk",
    "",
  ])("rejects invalid purchaseUrl %s", (purchaseUrl) => {
    const variant = makeValidFurnitureVariant();
    variant.purchaseUrl = purchaseUrl;

    expectInvalid(variant, "purchaseUrl");
  });

  it("accepts a null purchaseUrl", () => {
    const variant = makeValidFurnitureVariant();
    variant.purchaseUrl = null;

    expect(validateFurnitureVariant(variant, makeTestMaterialCatalog()).purchaseUrl).toBeNull();
  });

  it("rejects extrudedPolygon with fewer than three points", () => {
    const variant = makeValidFurnitureVariant();
    const part = asMutableRecord(variant.parts[0]);
    part.geometry = "extrudedPolygon";
    part.points = [[0, 0], [1, 0]];
    part.height = 0.05;

    expectInvalid(variant, "at least 3 points");
  });

  it("rejects an invalid extrudedPolygon point", () => {
    const variant = makeValidFurnitureVariant();
    const part = asMutableRecord(variant.parts[0]);
    part.geometry = "extrudedPolygon";
    part.points = [[0, 0], [1, Number.NaN], [1, 1]];
    part.height = 0.05;

    expectInvalid(variant, "points[1]");
  });

  it("rejects unsupported geometry", () => {
    const variant = makeValidFurnitureVariant();
    asMutableRecord(variant.parts[0]).geometry = "sphere";

    expectInvalid(variant, "Unsupported geometry type");
  });

  it("accepts roundedBox smoothness from 1 through 10", () => {
    const minimum = makeValidFurnitureVariant();
    asMutableRecord(minimum.parts[0]).smoothness = 1;
    expect(validateFurnitureVariant(minimum, makeTestMaterialCatalog()).parts[0]).toMatchObject({
      geometry: "roundedBox",
      smoothness: 1,
    });

    const maximum = makeValidFurnitureVariant();
    asMutableRecord(maximum.parts[0]).smoothness = 10;
    expect(validateFurnitureVariant(maximum, makeTestMaterialCatalog()).parts[0]).toMatchObject({
      geometry: "roundedBox",
      smoothness: 10,
    });
  });

  it.each([0, 11, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid roundedBox smoothness %s",
    (smoothness) => {
      const variant = makeValidFurnitureVariant();
      asMutableRecord(variant.parts[0]).smoothness = smoothness;

      expectInvalid(variant, "smoothness must be an integer between 1 and 10");
    },
  );
});

function expectInvalid(variant: unknown, message: string): void {
  expect(() => validateFurnitureVariant(variant, makeTestMaterialCatalog())).toThrowError(message);
}

function asMutableRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}
