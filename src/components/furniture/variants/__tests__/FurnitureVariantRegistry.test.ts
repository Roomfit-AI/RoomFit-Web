import { describe, expect, it } from "vitest";
import { FurnitureVariantRegistry } from "../FurnitureVariantRegistry";
import { validateFurnitureVariant } from "../validateFurnitureVariant";
import { makeTestMaterialCatalog, makeValidFurnitureVariant } from "./fixtures";

describe("FurnitureVariantRegistry", () => {
  it("registers and resolves a validated variant by variantId", () => {
    const registry = new FurnitureVariantRegistry();
    const variant = validateFurnitureVariant(makeValidFurnitureVariant(), makeTestMaterialCatalog());

    registry.registerFurnitureVariant(variant);

    expect(registry.hasFurnitureVariant(variant.variantId)).toBe(true);
    expect(registry.getFurnitureVariant(variant.variantId)).toBe(variant);
  });

  it("rejects duplicate registration", () => {
    const registry = new FurnitureVariantRegistry();
    const variant = validateFurnitureVariant(makeValidFurnitureVariant(), makeTestMaterialCatalog());
    registry.registerFurnitureVariant(variant);

    expect(() => registry.registerFurnitureVariant(variant)).toThrowError("already registered");
  });

  it("throws a clear error for an unregistered variantId", () => {
    const registry = new FurnitureVariantRegistry();

    expect(() => registry.getFurnitureVariant("missing-variant")).toThrowError(
      'Furniture variant "missing-variant" is not registered',
    );
  });
});
