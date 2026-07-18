import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import type { FeedbackOperationResult, FeedbackResponse } from "../../../api/layouts";
import type { RoomLayout } from "../../../types";
import FeedbackAgentResultPanel from "../FeedbackAgentResultPanel";
import {
  getFeedbackOperationLabel,
  getFeedbackReasonMessage,
  normalizeFeedbackPresentation,
  resolveFeedbackRoomLayout,
  resolveNextFeedbackLayoutId,
  shouldApplyFeedbackFurniture,
} from "../feedbackPresentation";

describe("feedback Agent presentation", () => {
  it("keeps the legacy response UI-compatible without an empty Agent panel", () => {
    const response = createResponse();
    const presentation = normalizeFeedbackPresentation(response);
    const result = resolveFeedbackRoomLayout(createRoom(), response);

    expect(presentation.feedbackStatus).toBe("SUCCESS");
    expect(presentation.showPanel).toBe(false);
    expect(FeedbackAgentResultPanel({ presentation })).toBeNull();
    expect(result.roomLayout.furniture[0].position.x).toBeCloseTo(0.5);
  });

  it("shows SUCCESS operations in the original plan order", () => {
    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "SUCCESS",
      message: "요청을 모두 반영했습니다.",
      operationResults: [
        createOperation("op-1", "MOVE", "APPLIED", "침대를 옮겼습니다."),
        createOperation("op-2", "ROTATE", "APPLIED", "책상을 회전했습니다."),
      ],
    }));
    const text = collectText(FeedbackAgentResultPanel({ presentation }));
    const renderedText = text.join("");

    expect(text).toContain("전체 반영");
    expect(renderedText.indexOf("1. 가구 이동")).toBeLessThan(renderedText.indexOf("2. 가구 회전"));
    expect(text.filter((value) => value === "반영됨")).toHaveLength(2);
  });

  it("counts PARTIAL_SUCCESS and applies the Backend furniture snapshot", () => {
    const current = createRoom();
    const response = createResponse({
      feedbackStatus: "PARTIAL_SUCCESS",
      operationResults: [
        createOperation("op-1", "MOVE", "APPLIED", "책상을 옮겼습니다."),
        createOperation("op-2", "ADD_FURNITURE", "FAILED", "협탁을 추가하지 못했습니다.", "NO_VALID_ADD_PLACEMENT"),
        createOperation("op-3", "ROTATE", "APPLIED", "책상을 회전했습니다."),
      ],
    });
    const result = resolveFeedbackRoomLayout(current, response);
    const text = collectText(FeedbackAgentResultPanel({ presentation: result.presentation }));

    expect(text).toContain("3개 중 2개 반영 · 실패 1개 · 보류 0개");
    expect(text).toContain("반영 실패");
    expect(text).toContain("새 가구를 안전하게 배치할 공간이 없습니다.");
    expect(result.roomLayout).not.toBe(current);
    expect(result.roomLayout.furniture[0].position.x).toBeCloseTo(0.5);
  });

  it("treats FAILED as a normal Agent result and preserves the current layout", () => {
    const current = createRoom();
    const response = createResponse({
      feedbackStatus: "FAILED",
      message: "요청한 변경을 적용하지 못했습니다.",
      operationResults: [
        createOperation("op-1", "MOVE", "FAILED", "다른 가구와 충돌합니다.", "COLLISION_DETECTED"),
      ],
    });
    const result = resolveFeedbackRoomLayout(current, response);
    const text = collectText(FeedbackAgentResultPanel({ presentation: result.presentation }));

    expect(result.roomLayout).toBe(current);
    expect(text).toContain("반영 실패");
    expect(text).toContain("다른 가구와 충돌합니다.");
  });

  it("shows clarification candidates in stable order without an action button", () => {
    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "NEEDS_CLARIFICATION",
      operationResults: [
        createOperation("op-1", "MOVE", "NEEDS_CLARIFICATION", "대상을 특정해 주세요.", "AMBIGUOUS_TARGET"),
      ],
      clarification: {
        reasonCode: "AMBIGUOUS_TARGET",
        question: "어떤 의자를 옮길까요?",
        candidates: [
          { furnitureId: "chair-1", type: "desk_chair", label: "책상 의자" },
          { furnitureId: "chair-2", type: "desk_chair", label: "보조 의자" },
        ],
      },
    }));
    const element = FeedbackAgentResultPanel({ presentation });
    const text = collectText(element);

    expect(text).toContain("어떤 의자를 옮길까요?");
    expect(text.indexOf("책상 의자")).toBeLessThan(text.indexOf("보조 의자"));
    expect(collectElementTypes(element)).not.toContain("button");
    expect(shouldApplyFeedbackFurniture(presentation)).toBe(false);
  });

  it("applies successful furniture changes for PARTIAL_SUCCESS with clarification", () => {
    const current = createRoom();
    const response = createResponse({
      feedbackStatus: "PARTIAL_SUCCESS",
      operationResults: [
        createOperation("op-1", "MOVE", "APPLIED", "침대를 옮겼습니다."),
        createOperation("op-2", "MOVE", "NEEDS_CLARIFICATION", "의자를 특정해 주세요.", "AMBIGUOUS_TARGET"),
      ],
      clarification: {
        reasonCode: "AMBIGUOUS_TARGET",
        question: "어떤 의자를 옮길까요?",
      },
    });
    const result = resolveFeedbackRoomLayout(current, response);

    expect(result.roomLayout).not.toBe(current);
    expect(result.presentation.clarifications[0]?.question).toBe("어떤 의자를 옮길까요?");
  });

  it("preserves the current layout whenever no operation was applied", () => {
    const current = createRoom();
    const response = createResponse({
      feedbackStatus: "PARTIAL_SUCCESS",
      operationResults: [
        createOperation("op-1", "MOVE", "FAILED", "가구를 옮기지 못했습니다.", "COLLISION_DETECTED"),
        createOperation("op-2", "ROTATE", "SKIPPED_DEPENDENCY", "회전을 건너뛰었습니다.", "DEPENDENCY_NOT_APPLIED"),
      ],
    });

    expect(resolveFeedbackRoomLayout(current, response).roomLayout).toBe(current);
  });

  it("uses the Backend clarifications array without duplicating its singular alias", () => {
    const clarification = {
      reasonCode: "AMBIGUOUS_TARGET",
      question: "어떤 의자를 옮길까요?",
      operationId: "op-1",
      requiredField: "targetFurnitureId",
      candidates: [{ furnitureId: "chair-1", type: "desk_chair", label: "책상 의자" }],
    };
    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "NEEDS_CLARIFICATION",
      clarification,
      clarifications: [
        clarification,
        {
          ...clarification,
          operationId: "op-2",
          question: "어떤 책상을 기준으로 사용할까요?",
        },
      ],
    }));
    const text = collectText(FeedbackAgentResultPanel({ presentation }));

    expect(presentation.clarifications).toHaveLength(2);
    expect(text).toContain("어떤 의자를 옮길까요?");
    expect(text).toContain("어떤 책상을 기준으로 사용할까요?");
  });

  it("updates the active Draft only for a different valid response layoutId", () => {
    expect(resolveNextFeedbackLayoutId(11, 12)).toBe(12);
    expect(resolveNextFeedbackLayoutId(11, 11)).toBeNull();
    expect(resolveNextFeedbackLayoutId(11, null)).toBeNull();
    expect(resolveNextFeedbackLayoutId(11, undefined)).toBeNull();
  });

  it("labels dependency skips and explains the reason", () => {
    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "FAILED",
      operationResults: [
        createOperation(
          "op-2",
          "ROTATE",
          "SKIPPED_DEPENDENCY",
          "앞선 이동 작업 때문에 회전을 건너뛰었습니다.",
          "DEPENDENCY_NOT_APPLIED",
        ),
      ],
    }));
    const text = collectText(FeedbackAgentResultPanel({ presentation }));

    expect(text).toContain("건너뜀");
    expect(text).toContain("앞선 작업이 적용되지 않아 이 작업을 건너뛰었습니다.");
  });

  it("renders unknown operation and reason codes safely", () => {
    expect(getFeedbackOperationLabel("FUTURE_OPERATION")).toBe("FUTURE_OPERATION");
    expect(getFeedbackReasonMessage("FUTURE_REASON")).toBe("사유 코드: FUTURE_REASON");

    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "FAILED",
      operationResults: [
        createOperation("op-1", "FUTURE_OPERATION", "FAILED", "아직 처리하지 못했습니다.", "FUTURE_REASON"),
      ],
    }));
    const text = collectText(FeedbackAgentResultPanel({ presentation }));

    expect(text.join("")).toContain("1. FUTURE_OPERATION");
    expect(text).toContain("사유 코드: FUTURE_REASON");
  });

  it("does not render an empty operation section", () => {
    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "SUCCESS",
      operationResults: [],
    }));
    const text = collectText(FeedbackAgentResultPanel({ presentation }));

    expect(text).toContain("전체 반영");
    expect(text).not.toContain("작업별 결과");
  });
});

function createRoom(): RoomLayout {
  return {
    id: "room-7",
    name: "테스트 방",
    width: 4,
    depth: 3,
    height: 2.4,
    walls: [],
    doors: [],
    windows: [],
    furniture: [
      {
        id: "desk-1",
        name: "책상",
        category: "desk",
        productId: "desk-compact-01",
        variantId: "desk-compact",
        styleTags: ["minimal"],
        dimensions: { width: 1.2, depth: 0.6, height: 0.73 },
        position: { x: 0, z: 0 },
        rotationY: 0,
        color: "#8a6545",
        geometry: "box",
        material: "wood",
        status: "recommended",
        removable: true,
      },
    ],
  };
}

function createResponse(overrides: Partial<FeedbackResponse> = {}): FeedbackResponse {
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
        width: 1.2,
        depth: 0.6,
        height: 0.73,
        position: { x: 2.5, z: 1.5 },
        rotation: 90,
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
    ...overrides,
  };
}

function createOperation(
  operationId: string,
  operationType: string,
  status: FeedbackOperationResult["status"],
  message: string,
  reasonCode: string | null = null,
): FeedbackOperationResult {
  return {
    operationId,
    operationType,
    status,
    reasonCode,
    message,
    targetFurnitureId: "desk-1",
    resultFurnitureId: status === "APPLIED" ? "desk-1" : null,
  };
}

function collectText(node: ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return collectText(node.props.children);
}

function collectElementTypes(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(collectElementTypes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [typeof node.type === "string" ? node.type : "component", ...collectElementTypes(node.props.children)];
}
