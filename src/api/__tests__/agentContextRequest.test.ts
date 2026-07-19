import { describe, expect, it } from "vitest";
import {
  buildAgentContextRequest,
  normalizeBackendRoomId,
  normalizeSelectedImageIds,
  resolveDesignStyle,
  resolveLifestyleGoal,
  resolveRequiredFurnitureTypes,
  resolveStyleImageIds,
} from "../agentContextRequest";
import { PREFERRED_COLOR_TONE_OPTIONS } from "../../config/preferredColorTone";
import { FURNITURE_TYPE_BY_UI_ID } from "../../config/furnitureSelectionCatalog";

const baseInput = {
  roomId: 1,
  purpose: "work",
  style: "minimal",
  palette: "ivory",
  additionalFurnitureIds: ["desk"],
};

describe("Agent Context request mappings", () => {
  it("maps every onboarding lifestyle to the existing Backend contract", () => {
    expect(resolveLifestyleGoal("rest")).toBe("RELAX_FOCUSED");
    expect(resolveLifestyleGoal("work")).toBe("STUDY_FOCUSED");
    expect(resolveLifestyleGoal("storage")).toBe("STORAGE_FOCUSED");
    expect(resolveLifestyleGoal("hobby")).toBe("RELAX_FOCUSED");
    expect(resolveLifestyleGoal("업무 / 공부")).toBeNull();
  });

  it("maps every current style ID explicitly", () => {
    expect(resolveDesignStyle("minimal")).toBe("MINIMAL");
    expect(resolveDesignStyle("natural")).toBe("NATURAL");
    expect(resolveDesignStyle("modern")).toBe("MODERN");
    expect(resolveDesignStyle("classic")).toBe("CLASSIC");
    expect(resolveDesignStyle("midcentury")).toBe("MIDCENTURY");
    expect(resolveDesignStyle("화이트톤")).toBeNull();
  });

  it("uses explicit style-image IDs rather than an array index", () => {
    expect(resolveStyleImageIds("minimal")).toEqual([1]);
    expect(resolveStyleImageIds("natural")).toEqual([2]);
    expect(resolveStyleImageIds("modern")).toEqual([3]);
    expect(resolveStyleImageIds("classic")).toEqual([4]);
    expect(resolveStyleImageIds("midcentury")).toEqual([5]);
    expect(resolveStyleImageIds("unknown")).toEqual([]);
  });

  it("maps generic UI furniture to required types in selection order", () => {
    expect(resolveRequiredFurnitureTypes([
      "desk",
      "desk-chair",
      "mood-light",
      "rug",
      "wardrobe",
    ])).toEqual(["desk", "desk_chair", "mood_lamp", "rug", "wardrobe"]);
  });

  it("deduplicates types and ignores unsupported IDs without making Product IDs", () => {
    expect(resolveRequiredFurnitureTypes([
      "desk",
      "desk",
      "bookshelf",
      "drawer",
      "desk-compact-01",
      "unknown",
    ])).toEqual(["desk", "bookshelf", "drawer_chest"]);
  });

  it("maps every UI furniture ID one-to-one to all 21 canonical types", () => {
    expect(FURNITURE_TYPE_BY_UI_ID).toEqual({
      bed: "bed",
      "sofa-bed": "sofa_bed",
      sofa: "sofa",
      desk: "desk",
      nightstand: "nightstand",
      "side-table": "side_table",
      "multi-table": "multi_table",
      "desk-chair": "desk_chair",
      bookshelf: "bookshelf",
      hanger: "hanger",
      partition: "partition_shelf",
      wardrobe: "wardrobe",
      drawer: "drawer_chest",
      "tv-console": "media_console",
      monitor: "monitor",
      tv: "tv",
      "mood-light": "mood_lamp",
      rug: "rug",
      plant: "plant",
      mirror: "full_length_mirror",
      curtain: "curtain_blind",
    });
    expect(resolveRequiredFurnitureTypes(Object.keys(FURNITURE_TYPE_BY_UI_ID)))
      .toEqual(Object.values(FURNITURE_TYPE_BY_UI_ID));
  });

  it("validates and deduplicates numeric style-image IDs", () => {
    expect(normalizeSelectedImageIds([1, "2", 1, 0, -1, 2.5, "3.5", "invalid", Number.NaN]))
      .toEqual([1, 2]);
  });

  it("rejects invalid Backend room IDs instead of falling back to room 1", () => {
    expect(normalizeBackendRoomId(7)).toBe(7);
    expect(normalizeBackendRoomId("7")).toBe(7);
    for (const value of [null, undefined, "", "room-7", "0", 0, -1, 1.5]) {
      expect(normalizeBackendRoomId(value)).toBeNull();
    }
  });

  it("builds the complete request from current selections", () => {
    expect(buildAgentContextRequest({
      roomId: "7",
      purpose: "work",
      style: "midcentury",
      palette: "brown",
      additionalFurnitureIds: ["desk", "desk-chair", "desk"],
    })).toEqual({
      roomId: 7,
      lifestyleGoal: "STUDY_FOCUSED",
      designStyle: ["MIDCENTURY"],
      requiredItems: ["desk", "desk_chair"],
      optionalItems: [],
      selectedImageIds: [5],
      selectedProductIds: [],
      preferredColorTone: "BROWN_WOOD",
    });
  });

  it("keeps all color tones separate from designStyle", () => {
    for (const { id } of PREFERRED_COLOR_TONE_OPTIONS) {
      const request = buildAgentContextRequest({ ...baseInput, palette: id });
      expect(request.designStyle).toEqual(["MINIMAL"]);
      expect(request.preferredColorTone).not.toBeNull();
    }
  });

  it("uses null for missing or unknown color tones", () => {
    expect(buildAgentContextRequest({ ...baseInput, palette: null }).preferredColorTone).toBeNull();
    expect(buildAgentContextRequest({ ...baseInput, palette: "unknown" }).preferredColorTone).toBeNull();
  });

  it("always leaves selectedProductIds empty for the generic furniture flow", () => {
    const request = buildAgentContextRequest({
      ...baseInput,
      additionalFurnitureIds: ["desk", "mood-light", "desk-compact-01"],
    });

    expect(request.requiredItems).toEqual(["desk", "mood_lamp"]);
    expect(request.selectedProductIds).toEqual([]);
  });

  it("rejects an empty or unsupported-only furniture selection before the API call", () => {
    expect(() => buildAgentContextRequest({ ...baseInput, additionalFurnitureIds: [] }))
      .toThrowError("가구를 하나 이상 선택");
    expect(() => buildAgentContextRequest({
      ...baseInput,
      additionalFurnitureIds: ["desk-compact-01", "unknown"],
    })).toThrowError("가구를 하나 이상 선택");
  });

  it("rejects an unknown style or empty image IDs before the API call", () => {
    expect(() => buildAgentContextRequest({ ...baseInput, style: "unknown" }))
      .toThrowError("인테리어 스타일");
    expect(() => buildAgentContextRequest({ ...baseInput, selectedImageIds: [] }))
      .toThrowError("스타일 이미지");
  });

  it("keeps all eight generic selections in the Backend request without inventing product IDs", () => {
    const request = buildAgentContextRequest({
      roomId: 17,
      purpose: "hobby",
      style: "modern",
      palette: "pink",
      additionalFurnitureIds: [
        "sofa", "nightstand", "side-table", "tv", "tv-console", "mood-light", "plant", "monitor",
      ],
    });

    expect(request).toMatchObject({
      roomId: 17,
      lifestyleGoal: "RELAX_FOCUSED",
      designStyle: ["MODERN"],
      requiredItems: [
        "sofa", "nightstand", "side_table", "tv", "media_console", "mood_lamp", "plant", "monitor",
      ],
      optionalItems: [],
      selectedProductIds: [],
      preferredColorTone: "PINK_CORAL",
    });
  });
});
