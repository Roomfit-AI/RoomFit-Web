import catalogDocument from "../data/furniture/catalog.json";

export const CANONICAL_FURNITURE_TYPES = Object.freeze(
  [...new Set(catalogDocument.products.map((product) => product.furnitureType))].sort(),
);

const aliases: Readonly<Record<string, string>> = Object.freeze(catalogDocument.typeAliases);

export function normalizeCanonicalFurnitureType(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  return aliases[trimmed] ?? aliases[trimmed.toUpperCase()] ?? aliases[normalized] ?? null;
}
