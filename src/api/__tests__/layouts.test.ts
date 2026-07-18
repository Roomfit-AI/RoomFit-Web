import { describe, expect, it, vi } from "vitest";

import { apiClient } from "../client";
import {
  applyLayoutFeedback,
  normalizeFeedbackResponse,
  normalizeRecommendationResponse,
  type FeedbackResponse,
} from "../layouts";

describe("layout recommendation response adapter", () => {
  it("keeps a legacy response as SUCCESS-compatible when additive fields are absent", () => {
    const result = normalizeRecommendationResponse(createFeedbackResponse());

    expect(result.layoutId).toBe(12);
    expect(result.recommendationStatus).toBeUndefined();
    expect(result.unplacedFurniture).toBeUndefined();
  });

  it("accepts PARTIAL_SUCCESS and preserves valid unplaced items in request order", () => {
    const result = normalizeRecommendationResponse({
      ...createFeedbackResponse(),
      recommendationStatus: "PARTIAL_SUCCESS",
      requestedFurnitureCount: 3,
      placedFurnitureCount: 1,
      unplacedFurniture: [
        {
          requestIndex: 1,
          furnitureType: "sofa",
          productId: "sofa-01",
          variantId: null,
          reasonCode: "COLLISION_DETECTED",
          message: "소파가 다른 가구와 충돌합니다.",
        },
        {
          requestIndex: 2,
          furnitureType: "desk",
          productId: null,
          variantId: null,
          reasonCode: "NO_VALID_PLACEMENT",
          message: "책상을 배치할 위치가 없습니다.",
        },
      ],
      warningCode: "INSUFFICIENT_ROOM_SPACE",
      message: "일부 가구만 배치했습니다.",
    });

    expect(result.recommendationStatus).toBe("PARTIAL_SUCCESS");
    expect(result.unplacedFurniture?.map((item) => item.requestIndex)).toEqual([1, 2]);
    expect(result.layoutId).toBe(12);
  });

  it("accepts a normal FAILED result with a null layoutId", () => {
    const result = normalizeRecommendationResponse({
      ...createFeedbackResponse(),
      layoutId: null,
      recommendationStatus: "FAILED",
      requestedFurnitureCount: 2,
      placedFurnitureCount: 0,
      unplacedFurniture: [],
    });

    expect(result.layoutId).toBeNull();
    expect(result.recommendationStatus).toBe("FAILED");
  });

  it("drops malformed additive fields without rejecting the legacy payload", () => {
    const result = normalizeRecommendationResponse({
      ...createFeedbackResponse(),
      recommendationStatus: "FUTURE_STATUS",
      requestedFurnitureCount: -1,
      placedFurnitureCount: 1.5,
      unplacedFurniture: [
        { requestIndex: "0", furnitureType: "bed", reasonCode: "NO_VALID_PLACEMENT" },
      ],
      warningCode: 42,
      message: {},
    });

    expect(result.recommendationStatus).toBeUndefined();
    expect(result.requestedFurnitureCount).toBeUndefined();
    expect(result.placedFurnitureCount).toBeUndefined();
    expect(result.unplacedFurniture).toEqual([]);
    expect(result.warningCode).toBeUndefined();
    expect(result.message).toBeUndefined();
    expect(result.layoutId).toBe(12);
  });
});

describe("layout feedback response adapter", () => {
  it("keeps a legacy response valid when Agent result fields are absent", async () => {
    const legacy = createFeedbackResponse();
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { success: true, data: legacy, error: null },
    });

    try {
      const result = await applyLayoutFeedback(11, "책상을 옮겨줘");

      expect(post).toHaveBeenCalledWith("/api/layouts/feedback", {
        layoutId: 11,
        feedback: "책상을 옮겨줘",
      });
      expect(result.layoutId).toBe(12);
      expect(result.feedbackStatus).toBeUndefined();
      expect(result.operationResults).toBeUndefined();
      expect(result.clarification).toBeUndefined();
    } finally {
      post.mockRestore();
    }
  });

  it("normalizes additive operation and clarification fields in Backend order", () => {
    const result = normalizeFeedbackResponse({
      ...createFeedbackResponse(),
      feedbackStatus: "PARTIAL_SUCCESS",
      message: "일부 작업을 반영했습니다.",
      operationResults: [
        createOperation("op-1", "MOVE", "APPLIED"),
        createOperation("op-2", "ADD_FURNITURE", "FAILED"),
      ],
      clarification: {
        reasonCode: "AMBIGUOUS_TARGET",
        question: "어떤 의자를 옮길까요?",
        candidates: [
          { furnitureId: "chair-1", type: "desk_chair", label: "책상 의자" },
          { furnitureId: "chair-2", type: "desk_chair", label: "보조 의자" },
        ],
      },
      clarifications: [
        {
          reasonCode: "AMBIGUOUS_TARGET",
          question: "어떤 의자를 옮길까요?",
          operationId: "op-2",
          requiredField: "targetFurnitureId",
          candidates: [{ furnitureId: "chair-2", type: "desk_chair", label: "보조 의자" }],
        },
      ],
    });

    expect(result.feedbackStatus).toBe("PARTIAL_SUCCESS");
    expect(result.operationResults?.map((operation) => operation.operationId)).toEqual(["op-1", "op-2"]);
    expect(result.clarification?.candidates?.map((candidate) => candidate.furnitureId)).toEqual(["chair-1", "chair-2"]);
    expect(result.clarifications?.map((item) => item.operationId)).toEqual(["op-2"]);
  });

  it("drops malformed additive fields without rejecting the legacy layout payload", () => {
    const result = normalizeFeedbackResponse({
      ...createFeedbackResponse(),
      feedbackStatus: "FUTURE_STATUS",
      operationResults: [{ operationId: "op-1", operationType: "MOVE", status: "FUTURE_STATUS" }],
      clarification: { reasonCode: "AMBIGUOUS_TARGET" },
      clarifications: [{ reasonCode: "AMBIGUOUS_TARGET" }],
    });

    expect(result.feedbackStatus).toBeUndefined();
    expect(result.operationResults).toEqual([]);
    expect(result.clarification).toBeUndefined();
    expect(result.clarifications).toEqual([]);
    expect(result.recommendedFurniture).toHaveLength(1);
  });
});

function createFeedbackResponse(): FeedbackResponse {
  return {
    layoutId: 12,
    roomId: 7,
    sourceLayoutId: 11,
    confirmed: false,
    confirmedAt: null,
    status: "SUCCESS",
    recommendedFurniture: [
      {
        id: "desk-1",
        type: "desk",
        label: "책상",
        width: 1.4,
        depth: 0.6,
        height: 0.73,
        position: { x: 2.5, z: 1.5 },
        rotation: 0,
        status: "RECOMMENDED",
        productId: "desk-compact-01",
        variantId: "desk-compact",
        styleTags: ["minimal"],
      },
    ],
    scoreSummary: {
      collisionScore: 20,
      boundaryScore: 20,
      doorWindowScore: 15,
      pathScore: 15,
      goalScore: 15,
      styleScore: 15,
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
  };
}

function createOperation(
  operationId: string,
  operationType: string,
  status: "APPLIED" | "FAILED",
) {
  return {
    operationId,
    operationType,
    status,
    reasonCode: status === "FAILED" ? "NO_VALID_ADD_PLACEMENT" : null,
    message: status === "APPLIED" ? "가구를 옮겼습니다." : "배치할 공간이 없습니다.",
    targetFurnitureId: "desk-1",
    resultFurnitureId: "desk-1",
    productId: "desk-compact-01",
    variantId: "desk-compact",
  };
}
