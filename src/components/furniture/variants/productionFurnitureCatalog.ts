import materialsDocument from "../../../data/furniture/materials.json";
import deskCompactDocument from "../../../data/furniture/variants/desk-compact.json";
import deskCornerDocument from "../../../data/furniture/variants/desk-corner.json";
import deskMidcenturyGlassDocument from "../../../data/furniture/variants/desk-midcentury-glass.json";
import deskStorageDocument from "../../../data/furniture/variants/desk-storage.json";
import { FurnitureVariantRegistry } from "./FurnitureVariantRegistry";
import { parseMaterialCatalogDocument } from "./materialResolver";
import type { MaterialPresetCatalog } from "./materialResolver";
import type { ValidatedFurnitureVariant } from "./types";
import { validateFurnitureVariant } from "./validateFurnitureVariant";

export const PRODUCTION_FURNITURE_VARIANT_IDS = [
  "desk-compact",
  "desk-storage",
  "desk-corner",
  "desk-midcentury-glass",
] as const;

export type ProductionFurnitureVariantId = (typeof PRODUCTION_FURNITURE_VARIANT_IDS)[number];

const PRODUCTION_VARIANT_DOCUMENTS: readonly unknown[] = [
  deskCompactDocument,
  deskStorageDocument,
  deskCornerDocument,
  deskMidcenturyGlassDocument,
];

export interface ProductionFurnitureCatalog {
  materialPresets: MaterialPresetCatalog;
  registry: FurnitureVariantRegistry;
  variants: ValidatedFurnitureVariant[];
}

export function createProductionFurnitureCatalog(): ProductionFurnitureCatalog {
  const materialPresets = parseMaterialCatalogDocument(materialsDocument);
  const registry = new FurnitureVariantRegistry();
  const variants = PRODUCTION_VARIANT_DOCUMENTS.map((document) =>
    validateFurnitureVariant(document, materialPresets));

  for (const [index, variant] of variants.entries()) {
    const expectedVariantId = PRODUCTION_FURNITURE_VARIANT_IDS[index];
    if (variant.variantId !== expectedVariantId) {
      throw new Error(
        `Production furniture document ${index} must define variantId "${expectedVariantId}", received "${variant.variantId}"`,
      );
    }
    registry.registerFurnitureVariant(variant);
  }

  return { materialPresets, registry, variants };
}
