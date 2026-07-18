import type { RecommendationStatus, ScoreSummary } from "../../api/layouts";
import { normalizeTotalScoreForDisplay } from "../../config/recommendationScore";

interface ScoreSummaryPanelProps {
  scoreSummary: ScoreSummary;
  recommendationStatus?: RecommendationStatus;
}

export default function ScoreSummaryPanel({
  scoreSummary,
  recommendationStatus,
}: ScoreSummaryPanelProps) {
  const showSuccessfulTotal = recommendationStatus !== "FAILED";

  return (
    <section className="rounded-xl border border-[#e6e6e6] bg-white p-5">
      <h2 className="text-lg font-extrabold">배치 점수</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Score label="충돌" value={scoreSummary.collisionScore} />
        <Score label="경계" value={scoreSummary.boundaryScore} />
        <Score label="동선" value={scoreSummary.pathScore} />
        {showSuccessfulTotal && (
          <Score label="총점" value={normalizeTotalScoreForDisplay(scoreSummary.totalScore)} />
        )}
      </div>
    </section>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f7f7f7] p-3">
      <span className="block text-xs font-bold text-[#777777]">{label}</span>
      <strong className="mt-1 block text-center text-lg font-extrabold">{value}</strong>
    </div>
  );
}
