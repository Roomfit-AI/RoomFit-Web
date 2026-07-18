import catalogDocument from "../../../data/furniture/catalog.json";
import materialsDocument from "../../../data/furniture/materials.json";
import { FurnitureVariantRegistry } from "./FurnitureVariantRegistry";
import { parseMaterialCatalogDocument } from "./materialResolver";
import type { MaterialPresetCatalog } from "./materialResolver";
import type { ValidatedFurnitureVariant } from "./types";
import { validateFurnitureVariant } from "./validateFurnitureVariant";

const variantModules = import.meta.glob("../../../data/furniture/variants/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

interface CatalogProduct {
  productId: string;
  variantId: string;
  furnitureType: string;
  dimensions: { width: number; depth: number; height: number };
  variantPath: string;
}

interface GeneratedCatalogDocument {
  schemaVersion: "1.0";
  catalogVersion: string;
  sourceHash: string;
  variantCount: number;
  products: CatalogProduct[];
}

const generatedCatalog = validateGeneratedCatalog(catalogDocument);

export const PRODUCTION_FURNITURE_VARIANT_IDS: readonly string[] = Object.freeze(
  generatedCatalog.products.map((product) => product.variantId),
);

export type ProductionFurnitureVariantId = string;

export const PRODUCTION_FURNITURE_CATALOG_METADATA = Object.freeze({
  catalogVersion: generatedCatalog.catalogVersion,
  sourceHash: generatedCatalog.sourceHash,
  variantCount: generatedCatalog.variantCount,
});

export interface ProductionFurnitureCatalog {
  materialPresets: MaterialPresetCatalog;
  registry: FurnitureVariantRegistry;
  variants: ValidatedFurnitureVariant[];
}

export function createProductionFurnitureCatalog(): ProductionFurnitureCatalog {
  const materialPresets = parseMaterialCatalogDocument(materialsDocument);
  const registry = new FurnitureVariantRegistry();
  const documentsByVariantId = indexVariantDocuments(variantModules);
  const variants = generatedCatalog.products.map((product) => {
    const document = documentsByVariantId.get(product.variantId);
    if (document === undefined) {
      throw new Error(`Catalog variant "${product.variantId}" has no bundled JSON document`);
    }
    const variant = validateFurnitureVariant(document, materialPresets);
    assertProductContract(product, variant);
    registry.registerFurnitureVariant(variant);
    return variant;
  });

  if (documentsByVariantId.size !== variants.length) {
    const registered = new Set(variants.map((variant) => variant.variantId));
    const extras = [...documentsByVariantId.keys()].filter((variantId) => !registered.has(variantId));
    throw new Error(`Bundled furniture JSON is missing from catalog manifest: ${extras.join(", ")}`);
  }

  return { materialPresets, registry, variants };
}

function indexVariantDocuments(modules: Record<string, unknown>): Map<string, unknown> {
  const documents = new Map<string, unknown>();
  for (const [modulePath, document] of Object.entries(modules)) {
    if (!isRecord(document) || typeof document.variantId !== "string") {
      throw new Error(`Furniture JSON "${modulePath}" does not declare variantId`);
    }
    if (documents.has(document.variantId)) {
      throw new Error(`Duplicate bundled furniture variant "${document.variantId}"`);
    }
    documents.set(document.variantId, document);
  }
  return documents;
}

function assertProductContract(product: CatalogProduct, variant: ValidatedFurnitureVariant): void {
  if (product.productId !== `${variant.variantId}-01`) {
    throw new Error(`Catalog productId for "${variant.variantId}" must be "${variant.variantId}-01"`);
  }
  if (product.furnitureType !== canonicalTypeCode(variant.furnitureTypeCode)) {
    throw new Error(`Catalog furniture type does not match variant "${variant.variantId}"`);
  }
  for (const dimension of ["width", "depth", "height"] as const) {
    if (product.dimensions[dimension] !== variant.dimensions[dimension]) {
      throw new Error(`Catalog ${dimension} does not match variant "${variant.variantId}"`);
    }
  }
}

function canonicalTypeCode(code: string): string | undefined {
  const aliases = (catalogDocument as { typeAliases?: Record<string, string> }).typeAliases;
  return aliases?.[code];
}

function validateGeneratedCatalog(input: unknown): GeneratedCatalogDocument {
  if (!isRecord(input) || input.schemaVersion !== "1.0") {
    throw new Error("Generated furniture catalog must use schemaVersion 1.0");
  }
  if (typeof input.catalogVersion !== "string" || !/^sha256:[a-f0-9]{64}$/.test(String(input.sourceHash))) {
    throw new Error("Generated furniture catalog metadata is invalid");
  }
  if (!Array.isArray(input.products) || input.products.length === 0 || input.variantCount !== input.products.length) {
    throw new Error("Generated furniture catalog product count is invalid");
  }
  return input as unknown as GeneratedCatalogDocument;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
