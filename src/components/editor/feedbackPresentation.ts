import type {
  FeedbackClarification,
  FeedbackOperationResult,
  FeedbackResponse,
  FeedbackStatus,
} from "../../api/layouts";
import { applyBackendFurnitureToLayout } from "../../api/rooms";
import type { RoomLayout } from "../../types";

export interface FeedbackPresentation {
  feedbackStatus: FeedbackStatus | null;
  summaryMessage: string | null;
  operationResults: FeedbackOperationResult[];
  clarifications: FeedbackClarification[];
  appliedCount: number;
  failedCount: number;
  pendingCount: number;
  showPanel: boolean;
}

export type FeedbackClarificationKind = "TARGET" | "PRODUCT" | "REFERENCE" | "GENERIC";

const PRODUCT_CLARIFICATION_REASONS = new Set([
  "NO_SAFE_SWAP_CANDIDATE",
  "NO_RENDERABLE_PRODUCT",
  "NO_LARGER_PRODUCT_AVAILABLE",
  "NO_SMALLER_PRODUCT_AVAILABLE",
]);

const OPERATION_LABELS: Record<string, string> = {
  MOVE: "가구 이동",
  ROTATE: "가구 회전",
  REPLACE_PRODUCT: "제품 변경",
  ADD_FURNITURE: "가구 추가",
  REMOVE_FURNITURE: "가구 삭제",
  SWAP_FURNITURE: "가구 교체",
  CHANGE_COLOR_TONE: "색상 톤 변경",
  CHANGE_MATERIAL: "재질 변경",
};

const REASON_MESSAGES: Record<string, string> = {
  TARGET_NOT_FOUND: "요청한 가구를 찾지 못했습니다.",
  AMBIGUOUS_TARGET: "조건에 맞는 가구가 여러 개입니다.",
  REFERENCE_TARGET_NOT_FOUND: "기준으로 지정한 가구를 찾지 못했습니다.",
  AMBIGUOUS_REFERENCE_TARGET: "기준 가구가 여러 개라 하나를 선택해야 합니다.",
  UNSUPPORTED_LOCATION_HINT: "해당 위치 표현은 아직 지원하지 않습니다.",
  NO_RENDERABLE_PRODUCT: "표시할 수 있는 제품 후보가 없습니다.",
  NO_LARGER_PRODUCT_AVAILABLE: "현재 가구보다 큰 교체 제품이 없습니다.",
  NO_SMALLER_PRODUCT_AVAILABLE: "현재 가구보다 작은 교체 제품이 없습니다.",
  NO_VALID_ADD_PLACEMENT: "새 가구를 안전하게 배치할 공간이 없습니다.",
  NO_VALID_SWAP_PLACEMENT: "교체 가구를 안전하게 배치할 수 없습니다.",
  NO_VALID_REPLACE_PLACEMENT: "변경할 제품을 안전하게 배치할 수 없습니다.",
  NO_VALID_BOUNDARY_PLACEMENT: "가구가 방 경계를 넘지 않는 위치를 찾지 못했습니다.",
  ROTATION_OUT_OF_BOUNDS: "회전하면 가구가 방 경계를 벗어납니다.",
  COLLISION_DETECTED: "다른 가구와 충돌합니다.",
  DOOR_BLOCKED: "문 사용 공간을 막습니다.",
  WINDOW_BLOCKED: "창문 사용 공간을 막습니다.",
  MOVEMENT_PATH_BLOCKED: "주요 이동 동선을 막습니다.",
  DEPENDENCY_NOT_APPLIED: "앞선 작업이 적용되지 않아 이 작업을 건너뛰었습니다.",
  CAPABILITY_UNAVAILABLE: "현재 지원하지 않는 변경입니다.",
  INVALID_OPERATION: "요청을 실행 가능한 작업으로 해석하지 못했습니다.",
};

export function normalizeFeedbackPresentation(response: FeedbackResponse): FeedbackPresentation {
  const operationResults = response.operationResults ?? [];
  const clarifications = response.clarifications && response.clarifications.length > 0
    ? response.clarifications
    : response.clarification
      ? [response.clarification]
      : [];
  const feedbackStatus = response.feedbackStatus
    ?? deriveFeedbackStatus(operationResults, clarifications)
    ?? parseLegacyStatus(response.status);
  const appliedCount = operationResults.filter((result) => result.status === "APPLIED").length;
  const failedCount = operationResults.filter((result) => result.status === "FAILED").length;

  return {
    feedbackStatus,
    summaryMessage: firstNonEmptyString(
      response.message,
      response.feedbackResult?.summary,
      response.feedbackResult?.noChangeReason,
    ),
    operationResults,
    clarifications,
    appliedCount,
    failedCount,
    pendingCount: operationResults.length - appliedCount - failedCount,
    showPanel: response.feedbackStatus !== undefined
      || operationResults.length > 0
      || clarifications.length > 0,
  };
}

export function shouldApplyFeedbackFurniture(presentation: FeedbackPresentation): boolean {
  if (!presentation.showPanel) return true;
  if (presentation.operationResults.length > 0 && presentation.appliedCount === 0) return false;
  if (presentation.feedbackStatus === "FAILED") return false;
  if (presentation.feedbackStatus === "NEEDS_CLARIFICATION") {
    return presentation.appliedCount > 0;
  }
  return true;
}

export function resolveFeedbackRoomLayout(
  currentRoom: RoomLayout,
  response: FeedbackResponse,
): { presentation: FeedbackPresentation; roomLayout: RoomLayout } {
  const presentation = normalizeFeedbackPresentation(response);
  return {
    presentation,
    roomLayout: shouldApplyFeedbackFurniture(presentation)
      ? applyBackendFurnitureToLayout(currentRoom, response.recommendedFurniture)
      : currentRoom,
  };
}

export function resolveNextFeedbackLayoutId(
  currentLayoutId: number,
  responseLayoutId: number | null | undefined,
): number | null {
  return typeof responseLayoutId === "number"
    && Number.isInteger(responseLayoutId)
    && responseLayoutId > 0
    && responseLayoutId !== currentLayoutId
    ? responseLayoutId
    : null;
}

export function getFeedbackOperationLabel(operationType: string): string {
  return OPERATION_LABELS[operationType] ?? operationType;
}

export function getFeedbackReasonMessage(reasonCode: string): string {
  return REASON_MESSAGES[reasonCode] ?? `사유 코드: ${reasonCode}`;
}

export function getFeedbackClarificationKind(
  clarification: FeedbackClarification,
): FeedbackClarificationKind {
  if (PRODUCT_CLARIFICATION_REASONS.has(clarification.reasonCode)) return "PRODUCT";
  if (clarification.reasonCode === "AMBIGUOUS_REFERENCE_TARGET"
    || clarification.requiredField === "referenceTargetFurnitureId") {
    return "REFERENCE";
  }
  if ((clarification.reasonCode === "AMBIGUOUS_TARGET"
      || clarification.requiredField === "targetFurnitureId")
    && (clarification.candidates?.length ?? 0) > 0) {
    return "TARGET";
  }
  return "GENERIC";
}

export function getFeedbackClarificationGuidance(
  clarification: FeedbackClarification,
): string {
  if (clarification.reasonCode === "NO_LARGER_PRODUCT_AVAILABLE") {
    return "현재 가구보다 큰 교체 제품이 없습니다. 제품 조건을 바꾸거나 요청 내용을 수정해 주세요.";
  }
  if (clarification.reasonCode === "NO_SMALLER_PRODUCT_AVAILABLE") {
    return "현재 가구보다 작은 교체 제품이 없습니다. 제품 조건을 바꾸거나 요청 내용을 수정해 주세요.";
  }

  const kind = getFeedbackClarificationKind(clarification);
  if (kind === "TARGET") return "변경할 가구를 선택해 주세요.";
  if (kind === "PRODUCT") return "제품 조건을 바꾸거나 요청 내용을 수정해 주세요.";
  if (kind === "REFERENCE") return "기준이 되는 가구를 요청 문장에 구체적으로 적어 주세요.";
  return "요청 내용을 더 구체적으로 적어 다시 시도해 주세요.";
}
function deriveFeedbackStatus(
  operationResults: FeedbackOperationResult[],
  clarifications: FeedbackClarification[],
): FeedbackStatus | null {
  if (operationResults.length === 0) {
    return clarifications.length > 0 ? "NEEDS_CLARIFICATION" : null;
  }

  const appliedCount = operationResults.filter((result) => result.status === "APPLIED").length;
  if (appliedCount === operationResults.length) return "SUCCESS";
  if (appliedCount > 0) return "PARTIAL_SUCCESS";
  if (operationResults.some((result) => result.status === "NEEDS_CLARIFICATION") || clarifications.length > 0) {
    return "NEEDS_CLARIFICATION";
  }
  return "FAILED";
}

function parseLegacyStatus(status: string): FeedbackStatus | null {
  return status === "SUCCESS"
    || status === "PARTIAL_SUCCESS"
    || status === "FAILED"
    || status === "NEEDS_CLARIFICATION"
    ? status
    : null;
}

function firstNonEmptyString(...values: Array<string | null | undefined>): string | null {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;
}
