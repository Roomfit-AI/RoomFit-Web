import { describe, expect, it } from "vitest";

import { currentScenario } from "../scenarios";

function createStorage(values: Record<string, string> = {}) {
  return {
    getItem: (key: string) => values[key] ?? null,
  };
}

describe("currentScenario", () => {
  it("matches rest-natural-wood only with the brown palette", () => {
    expect(currentScenario(createStorage({
      "roomfit:selectedPurpose": "rest",
      "roomfit:selectedStyle": "natural",
      "roomfit:selectedPalette": "brown",
    }))?.id).toBe("rest-natural-wood");

    expect(currentScenario(createStorage({
      "roomfit:selectedPurpose": "rest",
      "roomfit:selectedStyle": "natural",
      "roomfit:selectedPalette": "gray",
    }))).toBeUndefined();
  });

  it("matches work-modern-gray only with the gray palette", () => {
    expect(currentScenario(createStorage({
      "roomfit:selectedPurpose": "work",
      "roomfit:selectedStyle": "modern",
      "roomfit:selectedPalette": "gray",
    }))?.id).toBe("work-modern-gray");

    expect(currentScenario(createStorage({
      "roomfit:selectedPurpose": "work",
      "roomfit:selectedStyle": "modern",
      "roomfit:selectedPalette": "brown",
    }))).toBeUndefined();
  });

  it("does not match when only purpose or style agrees", () => {
    expect(currentScenario(createStorage({
      "roomfit:selectedPurpose": "rest",
      "roomfit:selectedStyle": "modern",
      "roomfit:selectedPalette": "brown",
    }))).toBeUndefined();

    expect(currentScenario(createStorage({
      "roomfit:selectedPurpose": "work",
      "roomfit:selectedStyle": "natural",
      "roomfit:selectedPalette": "brown",
    }))).toBeUndefined();
  });

  it("does not match when saved selections are absent", () => {
    expect(currentScenario(createStorage())).toBeUndefined();
  });
});
