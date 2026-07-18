import { describe, expect, it } from "vitest";

import { normalizeTotalScoreForDisplay } from "../recommendationScore";

describe("recommendation total score display normalization", () => {
  it.each([
    [0, 0],
    [450, 76],
    [570, 97],
    [590, 100],
    [-10, 0],
    [700, 100],
  ])("normalizes raw score %s to %s", (rawScore, displayScore) => {
    expect(normalizeTotalScoreForDisplay(rawScore)).toBe(displayScore);
  });
});
