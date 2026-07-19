import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FeedbackPresentation } from "../feedbackPresentation";
import EditorFeedbackPanel from "../EditorFeedbackPanel";
import {
  beginFeedbackRequest,
  createEmptyFeedbackResult,
  createSuccessfulFeedbackPresentation,
  readFeedbackErrorMessage,
  shouldAcceptFeedbackResponse,
} from "../feedbackResultState";

describe("EditorFeedbackPanel", () => {
  it("renders a successful result directly after the apply button", () => {
    const markup = renderPanel(createSuccessfulFeedbackPresentation());

    expect(markup).toContain("요청을 모두 반영했습니다.");
    expect(markup.indexOf("피드백 반영</button>")).toBeLessThan(markup.indexOf("요청을 모두 반영했습니다."));
  });

  it("renders request failures in the same result region without exposing the raw error code", () => {
    const message = "로프트 침대와 일반 책상은 동시에 배치할 수 없습니다.";
    const backendError = {
      isAxiosError: true,
      response: {
        data: {
          error: { code: "FURNITURE_DOMAIN_CONFLICT", message },
        },
      },
    };
    const userMessage = readFeedbackErrorMessage(backendError);
    const markup = renderToStaticMarkup(
      <EditorFeedbackPanel {...baseProps()} result={{ presentation: null, errorMessage: userMessage }} />,
    );

    expect(markup).toContain(message);
    expect(markup).not.toContain("FURNITURE_DOMAIN_CONFLICT");
    expect(countOccurrences(markup, message)).toBe(1);
  });

  it("renders clarification in the same result region", () => {
    const markup = renderPanel({
      ...presentation("NEEDS_CLARIFICATION"),
      clarifications: [{
        reasonCode: "AMBIGUOUS_TARGET",
        question: "어떤 가구를 말씀하시는지 확인이 필요합니다.",
      }],
    });

    expect(markup).toContain("정보 필요");
    expect(markup).toContain("어떤 가구를 말씀하시는지 확인이 필요합니다.");
    expect(countOccurrences(markup, "어떤 가구를 말씀하시는지 확인이 필요합니다.")).toBe(1);
  });

  it("places the feedback result before validation in sidebar DOM order", () => {
    const markup = renderToStaticMarkup(
      <aside>
        <EditorFeedbackPanel {...baseProps()} result={{
          presentation: createSuccessfulFeedbackPresentation(),
          errorMessage: "",
        }} />
        <section data-editor-section="validation">검증 결과</section>
      </aside>,
    );

    expect(markup.indexOf("data-feedback-result-region")).toBeLessThan(markup.indexOf('data-editor-section="validation"'));
  });

  it("uses one aria-live region and replaces an old result with loading state", () => {
    const markup = renderToStaticMarkup(
      <EditorFeedbackPanel
        {...baseProps()}
        isApplyingFeedback
        result={{
          presentation: createSuccessfulFeedbackPresentation(),
          errorMessage: "이전 실패 메시지",
        }}
      />,
    );

    expect(countOccurrences(markup, 'aria-live="polite"')).toBe(1);
    expect(markup).toContain("피드백을 반영하고 있습니다.");
    expect(markup).not.toContain("요청을 모두 반영했습니다.");
    expect(markup).not.toContain("이전 실패 메시지");
    expect(createEmptyFeedbackResult()).toEqual({ presentation: null, errorMessage: "" });
  });

  it("renders a structured failed Agent result in the same position", () => {
    const markup = renderPanel({
      ...presentation("FAILED"),
      summaryMessage: "요청한 위치에는 가구를 안전하게 배치할 수 없습니다.",
    });

    expect(markup).toContain("반영 실패");
    expect(markup).toContain("요청한 위치에는 가구를 안전하게 배치할 수 없습니다.");
  });

  it("starts only one request for rapid repeated candidate selection", () => {
    const inFlightRef = { current: false };

    expect(beginFeedbackRequest(inFlightRef)).toBe(true);
    expect(beginFeedbackRequest(inFlightRef)).toBe(false);
  });

  it("accepts only the latest mounted response for the active layout", () => {
    const current = {
      isMounted: true,
      currentSequence: 4,
      requestSequence: 4,
      activeLayoutId: 12,
      requestedLayoutId: 12,
    };

    expect(shouldAcceptFeedbackResponse(current)).toBe(true);
    expect(shouldAcceptFeedbackResponse({ ...current, isMounted: false })).toBe(false);
    expect(shouldAcceptFeedbackResponse({ ...current, currentSequence: 5 })).toBe(false);
    expect(shouldAcceptFeedbackResponse({ ...current, activeLayoutId: 13 })).toBe(false);
  });
});

function baseProps() {
  return {
    layoutReady: true,
    feedback: "책상을 옮겨줘",
    isApplyingFeedback: false,
    isRecommending: false,
    result: createEmptyFeedbackResult(),
    onFeedbackChange: vi.fn(),
    onApplyFeedback: vi.fn(),
    onRecommend: vi.fn(),
  };
}

function renderPanel(feedbackPresentation: FeedbackPresentation): string {
  return renderToStaticMarkup(
    <EditorFeedbackPanel
      {...baseProps()}
      result={{ presentation: feedbackPresentation, errorMessage: "" }}
    />,
  );
}

function presentation(feedbackStatus: FeedbackPresentation["feedbackStatus"]): FeedbackPresentation {
  return {
    feedbackStatus,
    summaryMessage: null,
    operationResults: [],
    clarifications: [],
    appliedCount: 0,
    failedCount: 0,
    pendingCount: 0,
    showPanel: true,
  };
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
