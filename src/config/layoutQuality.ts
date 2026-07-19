import type { LayoutValidationResult } from "../api/layouts";

export function resolveLayoutQuality(
  totalScore: number,
  validation: LayoutValidationResult,
): "양호" | "개선 필요" {
  const allChecksPassed = validation.collisionFree
    && validation.boundaryValid
    && validation.doorClearance
    && validation.windowClearance
    && validation.pathSecured;
  return allChecksPassed && totalScore >= 80 ? "양호" : "개선 필요";
}
