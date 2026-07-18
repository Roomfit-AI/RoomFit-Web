import { describe, expect, it } from "vitest";

import { RAW_TOTAL_SCORE_MAX } from "../../api/layouts";
import { buildScenarioValidation } from "../localValidation";

describe("local scenario score contract", () => {
  it("uses the same raw 590-point total as Backend recommendations", () => {
    const { scoreSummary } = buildScenarioValidation();
    const componentTotal = scoreSummary.collisionScore
      + scoreSummary.boundaryScore
      + scoreSummary.doorWindowScore
      + scoreSummary.pathScore
      + scoreSummary.goalScore
      + scoreSummary.styleScore;

    expect(scoreSummary.totalScore).toBe(RAW_TOTAL_SCORE_MAX);
    expect(scoreSummary.totalScore).toBe(componentTotal);
  });
});
