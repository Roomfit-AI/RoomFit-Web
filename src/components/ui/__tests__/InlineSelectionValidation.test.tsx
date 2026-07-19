import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import InlineSelectionValidation from "../InlineSelectionValidation";

describe("InlineSelectionValidation", () => {
  it("renders no permanent guidance before a next-step validation request", () => {
    expect(renderToStaticMarkup(<InlineSelectionValidation message="" />)).toBe("");
  });

  it("renders one accessible inline message after validation", () => {
    const message = "라이프스타일과 색상 톤을 선택해 주세요.";
    const markup = renderToStaticMarkup(<InlineSelectionValidation message={message} />);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('role="alert"');
    expect(markup.split(message)).toHaveLength(2);
  });
});
