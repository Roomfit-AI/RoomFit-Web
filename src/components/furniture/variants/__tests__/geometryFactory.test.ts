import { BoxGeometry, CylinderGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { describe, expect, it } from "vitest";
import {
  computeFurnitureVariantBounds,
  createFurniturePartGeometry,
} from "../geometryFactory";
import { validateFurnitureVariant } from "../validateFurnitureVariant";
import { makeTestMaterialCatalog, makeValidFurnitureVariant } from "./fixtures";

const PART_BASE = {
  id: "test-part",
  material: "testWhite",
  position: [0, 0, 0] as [number, number, number],
};

describe("createFurniturePartGeometry", () => {
  it("creates box geometry with X/Y/Z size order", () => {
    const geometry = createFurniturePartGeometry({
      ...PART_BASE,
      geometry: "box",
      size: [1, 0.2, 0.6],
    });

    expect(geometry).toBeInstanceOf(BoxGeometry);
    expect((geometry as BoxGeometry).parameters).toMatchObject({ width: 1, height: 0.2, depth: 0.6 });
    geometry.dispose();
  });

  it("creates rounded box geometry", () => {
    const geometry = createFurniturePartGeometry({
      ...PART_BASE,
      geometry: "roundedBox",
      size: [1, 0.2, 0.6],
      radius: 0.02,
      smoothness: 3,
    });

    expect(geometry).toBeInstanceOf(RoundedBoxGeometry);
    expect((geometry as RoundedBoxGeometry).parameters).toMatchObject({
      segments: 3,
      radius: 0.02,
    });
    geometry.dispose();
  });

  it("uses a deterministic safe radius when roundedBox radius is omitted", () => {
    const geometry = createFurniturePartGeometry({
      ...PART_BASE,
      geometry: "roundedBox",
      size: [1, 0.04, 0.6],
    });

    expect(geometry).toBeInstanceOf(RoundedBoxGeometry);
    expect((geometry as RoundedBoxGeometry).parameters).toMatchObject({
      segments: 4,
    });
    const parameters = (geometry as RoundedBoxGeometry).parameters as unknown as { radius: number };
    expect(parameters.radius).toBeCloseTo(0.014);
    geometry.dispose();
  });

  it("creates cylinder geometry using radiusTop, radiusBottom, heightY", () => {
    const geometry = createFurniturePartGeometry({
      ...PART_BASE,
      geometry: "cylinder",
      size: [0.1, 0.12, 0.7],
      radialSegments: 24,
    });

    expect(geometry).toBeInstanceOf(CylinderGeometry);
    expect((geometry as CylinderGeometry).parameters).toMatchObject({
      radiusTop: 0.1,
      radiusBottom: 0.12,
      height: 0.7,
      radialSegments: 24,
    });
    geometry.dispose();
  });

  it("extrudes a non-centered XZ polygon along centered Y while preserving +Z", () => {
    const geometry = createFurniturePartGeometry({
      ...PART_BASE,
      geometry: "extrudedPolygon",
      points: [[1, 2], [2, 2], [2, 3], [1, 3]],
      height: 0.2,
    });
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;

    expect(bounds).not.toBeNull();
    expect(bounds?.min.x).toBeCloseTo(1);
    expect(bounds?.max.x).toBeCloseTo(2);
    expect(bounds?.min.y).toBeCloseTo(-0.1);
    expect(bounds?.max.y).toBeCloseTo(0.1);
    expect(bounds?.min.z).toBeCloseTo(2);
    expect(bounds?.max.z).toBeCloseTo(3);
    geometry.dispose();
  });

  it("keeps the validated preview fixture on the floor with no scaling", () => {
    const variant = validateFurnitureVariant(makeValidFurnitureVariant(), makeTestMaterialCatalog());
    const bounds = computeFurnitureVariantBounds(variant);

    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.y).toBeCloseTo(variant.dimensions.height);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-variant.dimensions.width / 2);
    expect(bounds.max.x).toBeLessThanOrEqual(variant.dimensions.width / 2);
  });
});
