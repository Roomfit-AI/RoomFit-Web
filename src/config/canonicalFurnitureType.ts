import catalogDocument from "../data/furniture/catalog.json";

export const CANONICAL_FURNITURE_TYPES = [
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
] as const;

export type CanonicalFurnitureType = (typeof CANONICAL_FURNITURE_TYPES)[number];

const aliases: Readonly<Record<string, string>> = Object.freeze(catalogDocument.typeAliases);

export function normalizeCanonicalFurnitureType(value: unknown): CanonicalFurnitureType | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  const resolved = aliases[trimmed] ?? aliases[trimmed.toUpperCase()] ?? aliases[normalized];
  return isCanonicalFurnitureType(resolved) ? resolved : null;
}

export function isCanonicalFurnitureType(value: unknown): value is CanonicalFurnitureType {
  return typeof value === "string"
    && (CANONICAL_FURNITURE_TYPES as readonly string[]).includes(value);
}
