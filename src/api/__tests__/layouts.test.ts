import { describe, expect, it, vi } from "vitest";

import { apiClient } from "../client";
import {
  addFurnitureToDraft,
  applyLayoutFeedback,
  createDefaultAgentContext,
  getLayout,
  normalizeFeedbackResponse,
  normalizeRecommendationResponse,
  RAW_TOTAL_SCORE_MAX,
  type FeedbackResponse,
} from "../layouts";
import { FurnitureAdditionRequestError } from "../../config/furnitureAdditionError";

describe("layout recommendation response adapter", () => {
  it("sends every selected furniture type and preference through the actual Agent Context handler", async () => {
    const values = new Map<string, string>([
      ["roomfit:selectedPurpose", "hobby"],
      ["roomfit:selectedStyle", "modern"],
      ["roomfit:selectedPalette", "pink"],
      ["roomfit:selectedAdditionalFurnitureIds", JSON.stringify([
        "sofa", "nightstand", "side-table", "tv", "tv-console", "mood-light", "plant", "monitor",
      ])],
    ]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null });
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { success: true, data: { contextId: 4 }, error: null },
    });

    try {
      await createDefaultAgentContext(17);
      expect(post).toHaveBeenCalledExactlyOnceWith("/api/agent/context", {
        roomId: 17,
        lifestyleGoal: "RELAX_FOCUSED",
        designStyle: ["MODERN"],
        requiredItems: [
          "sofa", "nightstand", "side_table", "tv", "media_console", "mood_lamp", "plant", "monitor",
        ],
        optionalItems: [],
        selectedImageIds: [3],
        selectedProductIds: [],
        preferredColorTone: "PINK_CORAL",
      });
    } finally {
      post.mockRestore();
      vi.unstubAllGlobals();
    }
  });

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

  it("preserves the Backend raw totalScore on its 590-point scale", () => {
    const result = normalizeRecommendationResponse({
      ...createFeedbackResponse(),
      scoreSummary: {
        collisionScore: 100,
        boundaryScore: 100,
        doorWindowScore: 100,
        pathScore: 100,
        goalScore: 95,
        styleScore: 95,
        totalScore: 590,
      },
    });

    expect(RAW_TOTAL_SCORE_MAX).toBe(590);
    expect(result.scoreSummary.totalScore).toBe(590);
  });

  it("normalizes inbound aliases without losing product appearance metadata", () => {
    const result = normalizeRecommendationResponse({
      ...createFeedbackResponse(),
      recommendedFurniture: [{
        ...createFeedbackResponse().recommendedFurniture[0],
        type: "SOFA_BED",
        productId: "sofa-bed-classic-storage-01",
        variantId: "sofa-bed-classic-storage",
        styleTags: ["classic", "storage"],
      }],
      unplacedFurniture: [{
        requestIndex: 0,
        furnitureType: "tvStand",
        reasonCode: "NO_VALID_PLACEMENT",
        message: "",
      }],
    });

    expect(result.recommendedFurniture[0]).toMatchObject({
      type: "sofa_bed",
      productId: "sofa-bed-classic-storage-01",
      variantId: "sofa-bed-classic-storage",
      styleTags: ["classic", "storage"],
    });
    expect(result.unplacedFurniture?.[0].furnitureType).toBe("media_console");
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

  it("sends a selected furniture id only as an internal retry hint", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { success: true, data: createFeedbackResponse(), error: null },
    });

    try {
      await applyLayoutFeedback(11, "가구를 모서리에 배치해줘", { selectedFurnitureId: "chair-1" });

      expect(post).toHaveBeenCalledWith("/api/layouts/feedback", {
        layoutId: 11,
        feedback: "가구를 모서리에 배치해줘",
        selectedFurnitureId: "chair-1",
      });
    } finally {
      post.mockRestore();
    }
  });

  it("normalizes aliases on a later Layout reload as well", async () => {
    const response = createFeedbackResponse();
    response.recommendedFurniture[0].type = "BED";
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { success: true, data: response, error: null },
    });
    try {
      const result = await getLayout(12);
      expect(result.recommendedFurniture[0].type).toBe("bed");
      expect(result.recommendedFurniture[0].variantId).toBe("desk-compact");
    } finally {
      get.mockRestore();
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
          { furnitureId: "chair-1", type: "chair", label: "책상 의자" },
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
    expect(result.clarification?.candidates?.[0].type).toBe("desk_chair");
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

describe("furniture addition errors", () => {
  it.each([
    [422, "FURNITURE_ADDITION_FAILED", "PLACEMENT_REJECTED"],
    [500, "INTERNAL_SERVER_ERROR", "SERVER"],
    [undefined, undefined, "NETWORK"],
  ] as const)("classifies status %s separately", async (status, code, kind) => {
    const post = vi.spyOn(apiClient, "post").mockRejectedValue(axiosErrorLike(status, code));
    try {
      const request = addFurnitureToDraft(12, { contextId: 7 });
      await expect(request).rejects.toBeInstanceOf(FurnitureAdditionRequestError);
      await expect(request).rejects.toMatchObject({ kind });
    } finally {
      post.mockRestore();
    }
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

function axiosErrorLike(status?: number, code?: string) {
  return Object.assign(new Error("request failed"), {
    isAxiosError: true,
    response: status === undefined ? undefined : {
      status,
      data: { error: code ? { code } : null },
    },
  });
}
