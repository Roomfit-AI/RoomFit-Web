import { MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  createMaterialFromPreset,
  parseMaterialCatalogDocument,
  parseMaterialPresetCatalog,
  resolveMaterialPreset,
} from "../materialResolver";
import { TEST_MATERIALS_RAW, makeTestMaterialCatalog } from "./fixtures";

describe("materialResolver", () => {
  it("parses a schema 1.0 material catalog document", () => {
    const catalog = parseMaterialCatalogDocument({
      schemaVersion: "1.0",
      materials: TEST_MATERIALS_RAW,
    });

    expect(Object.keys(catalog)).toEqual(["testWhite", "testMetal"]);
  });

  it("rejects an unsupported catalog schema or empty materials", () => {
    expect(() => parseMaterialCatalogDocument({
      schemaVersion: "2.0",
      materials: TEST_MATERIALS_RAW,
    })).toThrowError("schemaVersion");
    expect(() => parseMaterialCatalogDocument({
      schemaVersion: "1.0",
      materials: {},
    })).toThrowError("non-empty object");
  });

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

  it("rejects invalid preset properties without external lookups", () => {
    expect(() => parseMaterialPresetCatalog({ invalid: { color: "" } })).toThrowError("color");
    expect(() => parseMaterialPresetCatalog({ invalid: {
      color: "#ffffff",
      roughness: Number.NaN,
    } })).toThrowError("roughness");
    expect(() => parseMaterialPresetCatalog({ invalid: {
      color: "#ffffff",
      roughness: 0.5,
      metalness: 1.1,
    } })).toThrowError("metalness");
    expect(() => parseMaterialPresetCatalog({ invalid: {
      color: "#ffffff",
      roughness: 0.5,
      metalness: 0,
      opacity: -0.1,
    } })).toThrowError("opacity");
    expect(() => parseMaterialPresetCatalog({ invalid: {
      color: "#ffffff",
      metalness: 0,
    } })).toThrowError("roughness");
  });
});
