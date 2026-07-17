import { describe, expect, it, vi } from "vitest";
import {
  findFurnitureVariantDimensionMismatches,
  getFurnitureVariantLocalYOffset,
  resolveFurnitureVariant,
  warnFurnitureVariantDimensionMismatch,
} from "../furnitureVariantRouting";

describe("furnitureVariantRouting", () => {
  it.each([
    "desk-compact",
    "desk-storage",
    "desk-corner",
    "desk-midcentury-glass",
  ])("resolves registered production variant %s", (variantId) => {
    expect(resolveFurnitureVariant(variantId)?.variantId).toBe(variantId);
  });

  it.each([null, undefined])("routes %s to the legacy renderer without warning", (variantId) => {
    const warn = vi.fn();

    expect(resolveFurnitureVariant(variantId, undefined, { isDevelopment: true, warn })).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns null and warns once for the same unknown variant", () => {
    const warn = vi.fn();
    const environment = { isDevelopment: true, warn };

    expect(resolveFurnitureVariant("unknown-routing-test", undefined, environment)).toBeNull();
    expect(resolveFurnitureVariant("unknown-routing-test", undefined, environment)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("does not call the throwing registry getter for an unknown variant", () => {
    const warn = vi.fn();
    const registry = {
      hasFurnitureVariant: vi.fn(() => false),
      getFurnitureVariant: vi.fn(() => {
        throw new Error("getter must not be called");
      }),
    };

    expect(
      resolveFurnitureVariant("unknown-getter-test", registry, { isDevelopment: true, warn }),
    ).toBeNull();
    expect(registry.hasFurnitureVariant).toHaveBeenCalledWith("unknown-getter-test");
    expect(registry.getFurnitureVariant).not.toHaveBeenCalled();
  });

  it.each([
    [0.73, -0.365],
    [1.42, -0.71],
  ])("uses a floor-center local Y offset for height %s", (height, expected) => {
    expect(getFurnitureVariantLocalYOffset(height)).toBe(expected);
  });

  it("accepts exactly matching dimensions", () => {
    const dimensions = { width: 1.2, depth: 0.6, height: 0.73 };

    expect(findFurnitureVariantDimensionMismatches(dimensions, dimensions)).toEqual([]);
  });

  it("accepts dimensions within the meter tolerance", () => {
    expect(
      findFurnitureVariantDimensionMismatches(
        { width: 1.2009, depth: 0.5991, height: 0.7309 },
        { width: 1.2, depth: 0.6, height: 0.73 },
      ),
    ).toEqual([]);
  });

  it.each(["width", "depth", "height"] as const)("detects a %s mismatch", (dimension) => {
    const furnitureDimensions = { width: 1.2, depth: 0.6, height: 0.73 };
    const variantDimensions = { ...furnitureDimensions, [dimension]: furnitureDimensions[dimension] + 0.01 };

    expect(findFurnitureVariantDimensionMismatches(furnitureDimensions, variantDimensions)).toEqual([
      {
        dimension,
        furnitureValue: furnitureDimensions[dimension],
        variantValue: variantDimensions[dimension],
      },
    ]);
  });

  it("warns once for the same dimension mismatch without blocking resolution", () => {
    const warn = vi.fn();
    const environment = { isDevelopment: true, warn };
    const furnitureDimensions = { width: 1.3, depth: 0.6, height: 0.73 };
    const variant = resolveFurnitureVariant("desk-compact");

    expect(variant).not.toBeNull();
    warnFurnitureVariantDimensionMismatch(
      "dimension-warning-test",
      furnitureDimensions,
      variant!.dimensions,
      environment,
    );
    warnFurnitureVariantDimensionMismatch(
      "dimension-warning-test",
      furnitureDimensions,
      variant!.dimensions,
      environment,
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(resolveFurnitureVariant("desk-compact")?.variantId).toBe("desk-compact");
  });
});
