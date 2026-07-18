export const RAW_TOTAL_SCORE_MAX = 590;

export function normalizeTotalScoreForDisplay(totalScore: number): number {
  const clampedScore = Math.min(Math.max(totalScore, 0), RAW_TOTAL_SCORE_MAX);
  return Math.round((clampedScore / RAW_TOTAL_SCORE_MAX) * 100);
}
