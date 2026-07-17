import type { ValidatedFurnitureVariant } from "./types";

export class FurnitureVariantRegistry {
  private readonly variants = new Map<string, ValidatedFurnitureVariant>();

  registerFurnitureVariant(variant: ValidatedFurnitureVariant): void {
    if (this.variants.has(variant.variantId)) {
      throw new Error(`Furniture variant "${variant.variantId}" is already registered`);
    }
    this.variants.set(variant.variantId, variant);
  }

  getFurnitureVariant(variantId: string): ValidatedFurnitureVariant {
    const variant = this.variants.get(variantId);
    if (!variant) {
      throw new Error(`Furniture variant "${variantId}" is not registered`);
    }
    return variant;
  }

  hasFurnitureVariant(variantId: string): boolean {
    return this.variants.has(variantId);
  }
}
