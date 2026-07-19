import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FeedbackOperationResult, FeedbackResponse } from "../../../api/layouts";
import type { RoomLayout } from "../../../types";
import FeedbackAgentResultPanel from "../FeedbackAgentResultPanel";
import {
  getFeedbackClarificationKind,
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

  it("shows clarification candidates as selectable labels without internal identifiers", () => {
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
    expect(collectElementTypes(element)).toContain("button");
    expect(text.join(" ")).not.toContain("chair-1");
    expect(text.join(" ")).not.toContain("desk_chair");
    expect(shouldApplyFeedbackFurniture(presentation)).toBe(false);
  });

  it("selects either target candidate by its internal id while rendering labels only", () => {
    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "NEEDS_CLARIFICATION",
      clarification: {
        reasonCode: "AMBIGUOUS_TARGET",
        question: "어떤 의자를 삭제할까요?",
        requiredField: "targetFurnitureId",
        candidates: [
          { furnitureId: "chair-1", type: "desk_chair", label: "창가 쪽 의자" },
          { furnitureId: "chair-2", type: "desk_chair", label: "책상 오른쪽 의자" },
        ],
      },
    }));
    const onSelectCandidate = vi.fn();
    const element = FeedbackAgentResultPanel({ presentation, onSelectCandidate });
    const buttons = collectElements(element, "button");

    buttons[0]?.props.onClick?.();
    buttons[1]?.props.onClick?.();

    expect(onSelectCandidate.mock.calls).toEqual([["chair-1"], ["chair-2"]]);
    expect(collectText(element).join(" ")).not.toContain("chair-");
  });

  it.each([
    ["REMOVE", "어느 의자를 삭제할까요?"],
    ["ROTATE", "어느 의자를 회전할까요?"],
    ["CHANGE_MATERIAL", "어느 의자의 재질을 바꿀까요?"],
    ["SWAP_PRODUCT", "어느 의자를 다른 제품으로 바꿀까요?"],
  ])("uses the same explicit target selection flow for %s", (operationType, question) => {
    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "NEEDS_CLARIFICATION",
      operationResults: [
        createOperation("op-1", operationType, "NEEDS_CLARIFICATION", question, "AMBIGUOUS_TARGET"),
      ],
      clarification: {
        reasonCode: "AMBIGUOUS_TARGET",
        question,
        requiredField: "targetFurnitureId",
        candidates: [{ furnitureId: "chair-1", label: "창가 쪽 의자" }],
      },
    }));
    const onSelectCandidate = vi.fn();
    const button = collectElements(FeedbackAgentResultPanel({ presentation, onSelectCandidate }), "button")[0];

    button?.props.onClick?.();

    expect(onSelectCandidate).toHaveBeenCalledOnce();
    expect(onSelectCandidate).toHaveBeenCalledWith("chair-1");
  });

  it("disables candidate buttons while a selection retry is pending", () => {
    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "NEEDS_CLARIFICATION",
      clarification: {
        reasonCode: "AMBIGUOUS_TARGET",
        question: "어떤 의자를 선택할까요?",
        requiredField: "targetFurnitureId",
        candidates: [{ furnitureId: "chair-1", label: "첫 번째 의자" }],
      },
    }));
    const button = collectElements(FeedbackAgentResultPanel({
      presentation,
      onSelectCandidate: vi.fn(),
      isSelectingCandidate: true,
    }), "button")[0];

    expect(button?.props.disabled).toBe(true);
  });

  it.each([
    ["NO_SAFE_SWAP_CANDIDATE", "제품 조건을 바꾸거나 요청 내용을 수정해 주세요."],
    ["NO_LARGER_PRODUCT_AVAILABLE", "현재 가구보다 큰 교체 제품이 없습니다."],
    ["NO_SMALLER_PRODUCT_AVAILABLE", "현재 가구보다 작은 교체 제품이 없습니다."],
  ])("does not offer target selection for product failure %s", (reasonCode, guidance) => {
    const current = createRoom();
    const clarification = {
      reasonCode,
      question: "조건에 맞는 교체 제품이 없습니다.",
      requiredField: "targetFurnitureId",
      candidates: [{ furnitureId: "desk-1", label: "현재 책상" }],
    };
    const result = resolveFeedbackRoomLayout(current, createResponse({
      feedbackStatus: "NEEDS_CLARIFICATION",
      clarification,
    }));
    const onSelectCandidate = vi.fn();
    const element = FeedbackAgentResultPanel({
      presentation: result.presentation,
      onSelectCandidate,
    });

    expect(getFeedbackClarificationKind(clarification)).toBe("PRODUCT");
    expect(collectElements(element, "button")).toHaveLength(0);
    expect(collectText(element).join(" ")).toContain(guidance);
    expect(onSelectCandidate).not.toHaveBeenCalled();
    expect(result.roomLayout).toBe(current);
  });

  it("does not treat reference ambiguity as target selection", () => {
    const reference = {
      reasonCode: "AMBIGUOUS_REFERENCE_TARGET",
      question: "기준 책상을 선택해야 합니다.",
      requiredField: "referenceTargetFurnitureId",
      candidates: [{ furnitureId: "desk-1", label: "창가 책상" }],
    };
    const presentation = normalizeFeedbackPresentation(createResponse({
      feedbackStatus: "NEEDS_CLARIFICATION",
      clarification: reference,
    }));
    const onSelectCandidate = vi.fn();
    const element = FeedbackAgentResultPanel({ presentation, onSelectCandidate });
    const text = collectText(element);

    expect(getFeedbackClarificationKind(reference)).toBe("REFERENCE");
    expect(collectElements(element, "button")).toHaveLength(0);
    expect(text).toContain("기준이 되는 가구를 요청 문장에 구체적으로 적어 주세요.");
    expect(onSelectCandidate).not.toHaveBeenCalled();
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

function collectElements(
  node: ReactNode,
  type: string,
): Array<ReactElement<{ onClick?: () => void; disabled?: boolean }>> {
  if (Array.isArray(node)) return node.flatMap((child) => collectElements(child, type));
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void; disabled?: boolean }>(node)) return [];
  const current = node.type === type ? [node] : [];
  return [...current, ...collectElements(node.props.children, type)];
}
