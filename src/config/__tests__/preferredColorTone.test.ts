import { describe, expect, it } from "vitest";
import {
  isPreferredColorToneId,
  normalizePreferredColorToneId,
  PREFERRED_COLOR_TONE_API_VALUES,
  PREFERRED_COLOR_TONE_OPTIONS,
  toPreferredColorToneApiValue,
} from "../preferredColorTone";

describe("preferredColorTone", () => {
  it("recognizes all eight persisted UI IDs", () => {
    const ids = PREFERRED_COLOR_TONE_OPTIONS.map(({ id }) => id);

    expect(ids).toEqual([
      "ivory",
      "beige",
      "gray",
      "brown",
      "green",
      "blue",
      "pink",
      "black",
    ]);
    expect(ids.every(isPreferredColorToneId)).toBe(true);
  });

  it("maps every UI ID to its explicit Backend value", () => {
    expect(PREFERRED_COLOR_TONE_API_VALUES).toEqual({
      ivory: "WHITE_IVORY",
      beige: "BEIGE_SAND",
      gray: "GRAY",
      brown: "BROWN_WOOD",
      green: "GREEN_OLIVE",
      blue: "BLUE_NAVY",
      pink: "PINK_CORAL",
      black: "BLACK_DARK",
    });

    for (const [id, apiValue] of Object.entries(PREFERRED_COLOR_TONE_API_VALUES)) {
      expect(toPreferredColorToneApiValue(id)).toBe(apiValue);
    }
  });

  it("normalizes nullish, blank and unknown values to no selection", () => {
    for (const value of [null, undefined, "", "unknown", 1]) {
      expect(normalizePreferredColorToneId(value)).toBeNull();
      expect(toPreferredColorToneApiValue(value)).toBeNull();
    }
  });

  it("does not infer an ID from a label", () => {
    expect(isPreferredColorToneId("화이트 / 아이보리")).toBe(false);
    expect(isPreferredColorToneId("white-ivory")).toBe(false);
    expect(toPreferredColorToneApiValue("브라운 / 우드")).toBeNull();
  });
});
