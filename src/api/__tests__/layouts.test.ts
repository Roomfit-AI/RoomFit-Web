import { describe, expect, it, vi } from "vitest";

import { apiClient } from "../client";
import {
  applyLayoutFeedback,
  normalizeFeedbackResponse,
  type FeedbackResponse,
} from "../layouts";

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
