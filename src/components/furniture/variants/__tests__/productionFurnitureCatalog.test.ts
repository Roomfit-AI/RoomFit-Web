import { CylinderGeometry, ExtrudeGeometry, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { describe, expect, it } from "vitest";
import {
  computeFurnitureVariantBounds,
  createFurniturePartGeometry,
} from "../geometryFactory";
import { resolveMaterialPreset } from "../materialResolver";
import {
  PRODUCTION_FURNITURE_VARIANT_IDS,
  createProductionFurnitureCatalog,
} from "../productionFurnitureCatalog";
import type { ValidatedFurnitureVariant } from "../types";

const BOUNDS_TOLERANCE = 0.0001;

describe("production furniture catalog", () => {
  it("validates and registers all four unique desk variants", () => {
    const catalog = createProductionFurnitureCatalog();
    const variantIds = catalog.variants.map((variant) => variant.variantId);

    expect(variantIds).toEqual(PRODUCTION_FURNITURE_VARIANT_IDS);
    expect(new Set(variantIds).size).toBe(PRODUCTION_FURNITURE_VARIANT_IDS.length);
    for (const variantId of PRODUCTION_FURNITURE_VARIANT_IDS) {
      expect(catalog.registry.getFurnitureVariant(variantId).variantId).toBe(variantId);
    }
  });

  it("keeps part IDs and material references valid for every production variant", () => {
    const { materialPresets, variants } = createProductionFurnitureCatalog();

    for (const variant of variants) {
      const partIds = variant.parts.map((part) => part.id);
      expect(new Set(partIds).size).toBe(partIds.length);

      for (const material of variant.materials) {
        expect(materialPresets).toHaveProperty(material);
      }
      for (const part of variant.parts) {
        expect(variant.materials).toContain(part.material);
        expect(materialPresets).toHaveProperty(part.material);
      }
    }
  });

  it("matches declared dimensions and floor-center bounds", () => {
    const { variants } = createProductionFurnitureCatalog();

    for (const variant of variants) {
      const bounds = computeFurnitureVariantBounds(variant);
      const size = bounds.getSize(new Vector3());

      expect(size.x).toBeCloseTo(variant.dimensions.width, 4);
      expect(size.y).toBeCloseTo(variant.dimensions.height, 4);
      expect(size.z).toBeCloseTo(variant.dimensions.depth, 4);
      expect(Math.abs(bounds.min.y)).toBeLessThanOrEqual(BOUNDS_TOLERANCE);
    }
  });

  it("keeps all production purchase URLs on HTTPS", () => {
    const { variants } = createProductionFurnitureCatalog();

    for (const variant of variants) {
      expect(variant.purchaseUrl).not.toBeNull();
      expect(new URL(variant.purchaseUrl as string).protocol).toBe("https:");
    }
  });

  it("preserves front and rear placement semantics for compact and storage desks", () => {
    const { registry } = createProductionFurnitureCatalog();
    const compact = registry.getFurnitureVariant("desk-compact");
    const storage = registry.getFurnitureVariant("desk-storage");

    expect(part(compact, "cable-tray").position[2]).toBeLessThan(0);
    for (const partId of ["drawer-1", "drawer-2", "drawer-3", "handle-1", "handle-2", "handle-3"]) {
      expect(part(storage, partId).position[2]).toBeGreaterThan(0);
    }
    expect(part(storage, "modesty-panel").position[2]).toBeLessThan(0);
  });

  it("builds the corner desktop on XZ with Y thickness and rear fixtures", () => {
    const { registry } = createProductionFurnitureCatalog();
    const corner = registry.getFurnitureVariant("desk-corner");
    const desktop = part(corner, "corner-desktop");
    const geometry = createFurniturePartGeometry(desktop);
    geometry.computeBoundingBox();

    expect(geometry).toBeInstanceOf(ExtrudeGeometry);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(-0.02);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(0.02);
    expect(geometry.boundingBox?.min.x).toBeCloseTo(-0.8);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(0.5);
    for (const partId of [
      "left-shelf-lower",
      "left-shelf-upper",
      "right-shelf-lower",
      "right-shelf-upper",
    ]) {
      expect(part(corner, partId).position[2]).toBeLessThan(0);
    }
    expect(part(corner, "magnetic-board").position[2]).toBeLessThan(0);
    geometry.dispose();
  });

  it("builds the midcentury glass top, Y-axis legs, and brass details", () => {
    const { materialPresets, registry } = createProductionFurnitureCatalog();
    const variant = registry.getFurnitureVariant("desk-midcentury-glass");
    const glassTopGeometry = createFurniturePartGeometry(part(variant, "glass-top"));
    const legGeometry = createFurniturePartGeometry(part(variant, "left-leg-front"));

    expect(glassTopGeometry).toBeInstanceOf(RoundedBoxGeometry);
    expect((glassTopGeometry as RoundedBoxGeometry).parameters).toMatchObject({
      radius: 0.009,
      segments: 5,
    });
    expect(legGeometry).toBeInstanceOf(CylinderGeometry);
    expect((legGeometry as CylinderGeometry).parameters.height).toBeCloseTo(0.72);
    expect(resolveMaterialPreset("glass", materialPresets)).toMatchObject({
      transparent: true,
      opacity: 0.42,
    });
    expect(variant.materials).toEqual(["glass", "woodDark", "brass"]);
    expect(variant.dimensions.height).toBe(0.812);

    glassTopGeometry.dispose();
    legGeometry.dispose();
  });
});

function part(
  variant: ValidatedFurnitureVariant,
  partId: string,
) {
  const furniturePart = variant.parts.find((item) => item.id === partId);
  if (!furniturePart) {
    throw new Error(`Expected part "${partId}" in variant "${variant.variantId}"`);
  }
  return furniturePart;
}
