import type {
  LayoutRecommendationResponse,
  RecommendationStatus,
  UnplacedFurniture,
} from "../api/layouts";

const RECOMMENDATION_RESULT_KEY = "roomfit:recommendationResult";
const RESULT_VERSION = 1;

type ResultStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface RecommendationResultOwner {
  sessionId: string;
  roomLayoutId: string;
  backendRoomId: number;
}

export interface RecommendationResultNotice {
  status: "PARTIAL_SUCCESS" | "FAILED";
  requestedFurnitureCount?: number;
  placedFurnitureCount?: number;
  unplacedFurniture: UnplacedFurniture[];
  warningCode?: string;
  message: string;
}

interface PersistedRecommendationResult extends RecommendationResultNotice, RecommendationResultOwner {
  version: 1;
}

export interface RecommendationDecision {
  status: RecommendationStatus;
  layoutResponse: LayoutRecommendationResponse;
  notice: RecommendationResultNotice | null;
}

const reasonMessages: Record<string, string> = {
  INSUFFICIENT_ROOM_SPACE: "선택한 가구를 모두 배치하기에는 방의 여유 공간이 부족합니다.",
  NO_VALID_PLACEMENT: "안전하게 배치할 수 있는 위치를 찾지 못했습니다.",
  NO_VALID_BOUNDARY_PLACEMENT: "가구를 방 경계 안에 안전하게 배치할 수 없습니다.",
  COLLISION_DETECTED: "다른 가구와 충돌하지 않는 위치를 찾지 못했습니다.",
  DOOR_BLOCKED: "문을 막지 않는 위치를 찾지 못했습니다.",
  WINDOW_BLOCKED: "창문을 막지 않는 위치를 찾지 못했습니다.",
  MOVEMENT_PATH_BLOCKED: "이동 동선을 확보할 수 있는 위치를 찾지 못했습니다.",
  UNSUPPORTED_FURNITURE_TYPE: "아직 지원하지 않는 가구 유형입니다.",
  NO_RENDERABLE_PRODUCT: "화면에 표시할 수 있는 제품을 찾지 못했습니다.",
  INVALID_FURNITURE_REQUEST: "선택한 가구 요청을 처리할 수 없습니다.",
};

const listeners = new Set<() => void>();

export class RecommendationFeasibilityError extends Error {
  readonly notice: RecommendationResultNotice;

  constructor(notice: RecommendationResultNotice) {
    super(notice.message);
    this.name = "RecommendationFeasibilityError";
    this.notice = notice;
  }
}

export function resolveRecommendationDecision(
  response: LayoutRecommendationResponse,
): RecommendationDecision {
  const status = response.recommendationStatus
    ?? (isPositiveInteger(response.layoutId) ? "SUCCESS" : null);

  if (!status) {
    throw new Error("Backend recommendation response has no valid status or layoutId.");
  }

  if (status !== "FAILED" && !isPositiveInteger(response.layoutId)) {
    throw new Error(`${status} recommendation response has no valid layoutId.`);
  }

  const notice = status === "PARTIAL_SUCCESS" || status === "FAILED"
    ? createRecommendationNotice(response, status)
    : null;

  return { status, layoutResponse: response, notice };
}

export function getRecommendationReasonMessage(reasonCode: string): string {
  return reasonMessages[reasonCode] ?? "배치 조건을 만족하지 못했습니다.";
}

export function getUnplacedFurnitureMessage(item: UnplacedFurniture): string {
  return item.message.trim() || getRecommendationReasonMessage(item.reasonCode);
}

export function saveRecommendationResult(
  owner: RecommendationResultOwner,
  notice: RecommendationResultNotice,
  storage: ResultStorage = sessionStorage,
): void {
  const value: PersistedRecommendationResult = {
    version: RESULT_VERSION,
    ...owner,
    ...notice,
  };

  try {
    storage.setItem(RECOMMENDATION_RESULT_KEY, JSON.stringify(value));
  } catch {
    // The result is advisory UI state. A storage failure must not invalidate
    // an otherwise successful Backend Layout response.
  }
  notifyListeners();
}

export function readRecommendationResult(
  owner: RecommendationResultOwner | null,
  storage: ResultStorage = sessionStorage,
): RecommendationResultNotice | null {
  if (!owner) return null;

  try {
    const raw = storage.getItem(RECOMMENDATION_RESULT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedRecommendationResult(parsed)) return null;
    if (parsed.sessionId !== owner.sessionId
      || parsed.roomLayoutId !== owner.roomLayoutId
      || parsed.backendRoomId !== owner.backendRoomId) {
      return null;
    }
    return {
      status: parsed.status,
      requestedFurnitureCount: parsed.requestedFurnitureCount,
      placedFurnitureCount: parsed.placedFurnitureCount,
      unplacedFurniture: parsed.unplacedFurniture,
      warningCode: parsed.warningCode,
      message: parsed.message,
    };
  } catch {
    return null;
  }
}

export function clearRecommendationResult(
  storage: Pick<ResultStorage, "getItem" | "removeItem"> = sessionStorage,
  expectedOwner?: RecommendationResultOwner,
): void {
  try {
    if (expectedOwner) {
      const raw = storage.getItem(RECOMMENDATION_RESULT_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isPersistedRecommendationResult(parsed)
          && (parsed.sessionId !== expectedOwner.sessionId
            || parsed.roomLayoutId !== expectedOwner.roomLayoutId
            || parsed.backendRoomId !== expectedOwner.backendRoomId)) {
          return;
        }
      }
    }
    storage.removeItem(RECOMMENDATION_RESULT_KEY);
  } catch {
    // Advisory state cleanup is best-effort.
  }
  notifyListeners();
}

export function subscribeRecommendationResult(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function createRecommendationNotice(
  response: LayoutRecommendationResponse,
  status: RecommendationResultNotice["status"],
): RecommendationResultNotice {
  const unplacedFurniture = response.unplacedFurniture ?? [];
  const fallbackCode = response.warningCode ?? unplacedFurniture[0]?.reasonCode;
  const defaultMessage = status === "PARTIAL_SUCCESS"
    ? "일부 가구만 안전하게 배치했습니다. 배치하지 못한 항목을 확인해 주세요."
    : "선택한 가구를 안전하게 배치하지 못했습니다. 가구 수를 줄여 다시 시도해 주세요.";

  return {
    status,
    requestedFurnitureCount: response.requestedFurnitureCount,
    placedFurnitureCount: response.placedFurnitureCount,
    unplacedFurniture,
    warningCode: response.warningCode,
    message: response.message?.trim()
      || (fallbackCode ? getRecommendationReasonMessage(fallbackCode) : defaultMessage),
  };
}

function isPersistedRecommendationResult(value: unknown): value is PersistedRecommendationResult {
  if (!isRecord(value)
    || value.version !== RESULT_VERSION
    || typeof value.sessionId !== "string"
    || !value.sessionId
    || typeof value.roomLayoutId !== "string"
    || !value.roomLayoutId
    || !isPositiveInteger(value.backendRoomId)
    || !(value.status === "PARTIAL_SUCCESS" || value.status === "FAILED")
    || typeof value.message !== "string"
    || !Array.isArray(value.unplacedFurniture)) {
    return false;
  }

  return (value.requestedFurnitureCount === undefined || isNonNegativeInteger(value.requestedFurnitureCount))
    && (value.placedFurnitureCount === undefined || isNonNegativeInteger(value.placedFurnitureCount))
    && (value.warningCode === undefined || typeof value.warningCode === "string")
    && value.unplacedFurniture.every(isUnplacedFurniture);
}

function isUnplacedFurniture(value: unknown): value is UnplacedFurniture {
  return isRecord(value)
    && isNonNegativeInteger(value.requestIndex)
    && typeof value.furnitureType === "string"
    && Boolean(value.furnitureType)
    && typeof value.reasonCode === "string"
    && Boolean(value.reasonCode)
    && typeof value.message === "string"
    && (value.productId === undefined || value.productId === null || typeof value.productId === "string")
    && (value.variantId === undefined || value.variantId === null || typeof value.variantId === "string");
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
