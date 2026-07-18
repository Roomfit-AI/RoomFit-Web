import { describe, expect, it } from "vitest";

import type { LayoutRecommendationResponse } from "../../api/layouts";
import {
  clearRecommendationResult,
  getRecommendationReasonMessage,
  getUnplacedFurnitureMessage,
  readRecommendationResult,
  resolveRecommendationDecision,
  saveRecommendationResult,
  type RecommendationResultOwner,
} from "../recommendationResult";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const ownerA: RecommendationResultOwner = {
  sessionId: "setup-a",
  roomLayoutId: "api-room-1",
  backendRoomId: 1,
};

describe("recommendation result lifecycle", () => {
  it("treats a legacy response with a valid layoutId as SUCCESS", () => {
    const decision = resolveRecommendationDecision(response(11));

    expect(decision.status).toBe("SUCCESS");
    expect(decision.notice).toBeNull();
  });

  it("builds PARTIAL_SUCCESS counts and unplaced reasons", () => {
    const decision = resolveRecommendationDecision(response(12, {
      recommendationStatus: "PARTIAL_SUCCESS",
      requestedFurnitureCount: 3,
      placedFurnitureCount: 2,
      warningCode: "INSUFFICIENT_ROOM_SPACE",
      message: "일부 가구만 배치했습니다.",
      unplacedFurniture: [{
        requestIndex: 2,
        furnitureType: "sofa",
        reasonCode: "NO_VALID_PLACEMENT",
        message: "소파를 배치할 수 없습니다.",
      }],
    }));

    expect(decision.notice).toMatchObject({
      status: "PARTIAL_SUCCESS",
      requestedFurnitureCount: 3,
      placedFurnitureCount: 2,
    });
    expect(decision.notice?.unplacedFurniture[0].reasonCode).toBe("NO_VALID_PLACEMENT");
  });

  it("distinguishes a normal FAILED result from a transport error", () => {
    const decision = resolveRecommendationDecision(response(null, {
      recommendationStatus: "FAILED",
      warningCode: "NO_VALID_BOUNDARY_PLACEMENT",
      message: "",
    }));

    expect(decision.status).toBe("FAILED");
    expect(decision.notice?.message).toBe("가구를 방 경계 안에 안전하게 배치할 수 없습니다.");
    expect(() => {
      throw new Error("network");
    }).toThrow("network");
  });

  it("rejects SUCCESS or PARTIAL_SUCCESS without a valid layoutId", () => {
    expect(() => resolveRecommendationDecision(response(null, {
      recommendationStatus: "SUCCESS",
    }))).toThrow("SUCCESS recommendation response has no valid layoutId");
  });

  it("keeps a warning inside its setup and Room owner", () => {
    const storage = new MemoryStorage();
    const notice = resolveRecommendationDecision(response(null, {
      recommendationStatus: "FAILED",
      requestedFurnitureCount: 2,
      placedFurnitureCount: 0,
      message: "공간이 부족합니다.",
    })).notice!;
    saveRecommendationResult(ownerA, notice, storage);

    expect(readRecommendationResult(ownerA, storage)?.status).toBe("FAILED");
    expect(readRecommendationResult({ ...ownerA, sessionId: "new-setup" }, storage)).toBeNull();
    expect(readRecommendationResult({ ...ownerA, roomLayoutId: "api-room-2" }, storage)).toBeNull();
    expect(readRecommendationResult({ ...ownerA, backendRoomId: 2 }, storage)).toBeNull();
  });

  it("does not clear another Room's warning through an owner-scoped cleanup", () => {
    const storage = new MemoryStorage();
    const notice = resolveRecommendationDecision(response(null, {
      recommendationStatus: "FAILED",
      message: "공간이 부족합니다.",
    })).notice!;
    saveRecommendationResult(ownerA, notice, storage);

    clearRecommendationResult(storage, { ...ownerA, roomLayoutId: "api-room-2" });

    expect(readRecommendationResult(ownerA, storage)).not.toBeNull();
    clearRecommendationResult(storage, ownerA);
    expect(readRecommendationResult(ownerA, storage)).toBeNull();
  });

  it("provides Korean fallbacks for every supported reason code", () => {
    const codes = [
      "INSUFFICIENT_ROOM_SPACE",
      "NO_VALID_PLACEMENT",
      "NO_VALID_BOUNDARY_PLACEMENT",
      "COLLISION_DETECTED",
      "DOOR_BLOCKED",
      "WINDOW_BLOCKED",
      "MOVEMENT_PATH_BLOCKED",
      "UNSUPPORTED_FURNITURE_TYPE",
      "NO_RENDERABLE_PRODUCT",
      "INVALID_FURNITURE_REQUEST",
    ];

    for (const code of codes) {
      expect(getRecommendationReasonMessage(code)).not.toBe("배치 조건을 만족하지 못했습니다.");
    }
  });

  it("prefers Backend messages and falls back to reasonCode for an empty item message", () => {
    expect(getUnplacedFurnitureMessage({
      requestIndex: 0,
      furnitureType: "desk",
      reasonCode: "COLLISION_DETECTED",
      message: "백엔드가 설명한 충돌 사유입니다.",
    })).toBe("백엔드가 설명한 충돌 사유입니다.");
    expect(getUnplacedFurnitureMessage({
      requestIndex: 0,
      furnitureType: "desk",
      reasonCode: "COLLISION_DETECTED",
      message: "",
    })).toBe("다른 가구와 충돌하지 않는 위치를 찾지 못했습니다.");
  });
});

function response(
  layoutId: number | null,
  overrides: Partial<LayoutRecommendationResponse> = {},
): LayoutRecommendationResponse {
  return {
    layoutId,
    roomId: 1,
    sourceLayoutId: null,
    confirmed: false,
    confirmedAt: null,
    status: "SUCCESS",
    recommendedFurniture: [],
    scoreSummary: {
      collisionScore: 100,
      boundaryScore: 100,
      doorWindowScore: 100,
      pathScore: 100,
      goalScore: 100,
      styleScore: 100,
      totalScore: 100,
    },
    validationResult: {
      collisionFree: true,
      boundaryValid: true,
      doorClearance: true,
      windowClearance: true,
      pathSecured: true,
      warnings: [],
    },
    ...overrides,
  };
}
