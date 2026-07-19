import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RecommendationGenerationPanel from "../RecommendationGenerationPanel";

describe("RecommendationGenerationPanel", () => {
  it("shows the explicit CTA and does not invoke it while rendering", () => {
    const onGenerate = vi.fn();
    const element = RecommendationGenerationPanel(props({ onGenerate }));
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("AI 추천 생성하기");
    expect(markup).toContain("아래 버튼을 누르기 전에는 추천이 시작되지 않습니다.");
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("disables the CTA and shows loading while a request is running", () => {
    const markup = renderToStaticMarkup(RecommendationGenerationPanel(props({ isGenerating: true })));
    expect(markup).toContain("추천 생성 중...");
    expect(findButton(RecommendationGenerationPanel(props({ isGenerating: true })), "추천 생성 중...")?.props.disabled).toBe(true);
  });

  it("keeps retry controls on the page and shows a friendly failure", () => {
    const onGenerate = vi.fn();
    const onPrevious = vi.fn();
    const element = RecommendationGenerationPanel(props({
      errorMessage: "AI 추천 생성에 실패했습니다. 선택한 내용을 유지한 채 다시 시도해 주세요.",
      onGenerate,
      onPrevious,
    }));
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('role="alert"');
    findButton(element, "AI 추천 생성하기")?.props.onClick?.();
    findButton(element, "이전 단계")?.props.onClick?.();
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });
});

function props(overrides: Partial<Parameters<typeof RecommendationGenerationPanel>[0]> = {}) {
  return {
    roomTitle: "테스트 방",
    selectedFurnitureCount: 2,
    isGenerating: false,
    errorMessage: "",
    ready: true,
    onGenerate: vi.fn(),
    onPrevious: vi.fn(),
    ...overrides,
  };
}

function findButton(node: ReactNode, text: string): React.ReactElement<{
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}> | null {
  if (Array.isArray(node)) {
    return node.map((child) => findButton(child, text)).find(Boolean) ?? null;
  }
  if (!isValidElement<{ disabled?: boolean; onClick?: () => void; children?: ReactNode }>(node)) return null;
  if (node.type === "button" && flattenText(node.props.children).includes(text)) return node;
  return findButton(node.props.children, text);
}

function flattenText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return flattenText(node.props.children);
  return "";
}
