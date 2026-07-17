import { parseMaterialPresetCatalog } from "../materialResolver";
import type { MaterialPresetCatalog } from "../materialResolver";
import type { FurnitureVariant } from "../types";

export const TEST_MATERIALS_RAW = {
  testWhite: {
    color: "#f5f5f2",
    roughness: 0.72,
    metalness: 0,
  },
  testMetal: {
    color: "#202225",
    roughness: 0.24,
    metalness: 0.82,
    transparent: true,
    opacity: 0.92,
    emissive: "#080808",
    emissiveIntensity: 0.1,
  },
};

export function makeTestMaterialCatalog(): MaterialPresetCatalog {
  return parseMaterialPresetCatalog(TEST_MATERIALS_RAW);
}

export function makeValidFurnitureVariant(): FurnitureVariant {
  return {
    schemaVersion: "1.0",
    variantId: "test-desk-compact",
    name: "Test compact desk",
    furnitureType: "desk",
    furnitureTypeCode: "DESK",
    variant: "compact",
    units: "meter",
    coordinateSystem: {
      origin: "floor-center",
      xAxis: "right",
      yAxis: "up",
      zAxis: "front",
    },
    rotationUnit: "radian",
    dimensions: { width: 1, depth: 0.6, height: 0.75 },
    materials: ["testWhite", "testMetal"],
    parts: [
      {
        id: "top",
        material: "testWhite",
        position: [0, 0.725, 0],
        geometry: "roundedBox",
        size: [1, 0.05, 0.6],
        smoothness: 4,
      },
      {
        id: "left-leg",
        material: "testMetal",
        position: [-0.42, 0.35, 0],
        rotation: [0, 0, 0],
        geometry: "box",
        size: [0.05, 0.7, 0.05],
      },
      {
        id: "right-leg",
        material: "testMetal",
        position: [0.42, 0.35, 0],
        geometry: "cylinder",
        size: [0.025, 0.025, 0.7],
      },
    ],
    styleTags: ["minimal", "modern"],
    lifestyleTags: ["WORK_STUDY"],
    purchaseUrl: "https://example.com/products/test-desk",
  };
}
