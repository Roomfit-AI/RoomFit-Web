import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ScoreSummary } from "../../../api/layouts";
import ScoreSummaryPanel from "../ScoreSummaryPanel";

describe("ScoreSummaryPanel", () => {
  it.each([
    ["SUCCESS" as const, 450, 76],
    ["PARTIAL_SUCCESS" as const, 570, 97],
  ])("shows the normalized total for %s", (status, rawTotal, displayTotal) => {
    const html = renderToStaticMarkup(
      <ScoreSummaryPanel
        scoreSummary={scoreSummary(rawTotal)}
        recommendationStatus={status}
      />,
    );

    expect(html).toContain("총점");
    expect(html).toContain(`>${displayTotal}<`);
    expect(html).not.toContain(`${rawTotal} / 590`);
  });

  it("hides the success-style total for a FAILED recommendation", () => {
    const html = renderToStaticMarkup(
      <ScoreSummaryPanel
        scoreSummary={scoreSummary(450)}
        recommendationStatus="FAILED"
      />,
    );

    expect(html).not.toContain("총점");
    expect(html).not.toContain(">76<");
    expect(html).toContain("충돌");
  });
});

function scoreSummary(totalScore: number): ScoreSummary {
  return {
    collisionScore: 91,
    boundaryScore: 92,
    doorWindowScore: 93,
    pathScore: 94,
    goalScore: 95,
    styleScore: 96,
    totalScore,
  };
}
