import { MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  createMaterialFromPreset,
  parseMaterialPresetCatalog,
  resolveMaterialPreset,
} from "../materialResolver";
import { TEST_MATERIALS_RAW, makeTestMaterialCatalog } from "./fixtures";

describe("materialResolver", () => {
  it("parses supported global material properties", () => {
    expect(parseMaterialPresetCatalog(TEST_MATERIALS_RAW).testMetal).toEqual({
      color: "#202225",
      roughness: 0.24,
      metalness: 0.82,
      transparent: true,
      opacity: 0.92,
      emissive: "#080808",
      emissiveIntensity: 0.1,
    });
  });

  it("resolves a preset to MeshStandardMaterial parameters and material", () => {
    const catalog = makeTestMaterialCatalog();
    const parameters = resolveMaterialPreset("testMetal", catalog);
    const material = createMaterialFromPreset("testMetal", catalog);

    expect(parameters).toMatchObject({
      color: "#202225",
      roughness: 0.24,
      metalness: 0.82,
      transparent: true,
      opacity: 0.92,
      emissive: "#080808",
      emissiveIntensity: 0.1,
    });
    expect(material).toBeInstanceOf(MeshStandardMaterial);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeCloseTo(0.92);
    material.dispose();
  });

  it("rejects an unknown preset instead of silently using gray", () => {
    expect(() => resolveMaterialPreset("missing", makeTestMaterialCatalog())).toThrowError(
      'Unknown material preset "missing"',
    );
  });
});
