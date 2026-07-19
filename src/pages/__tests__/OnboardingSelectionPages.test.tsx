import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Preference from "../Preference";
import ReferenceImage from "../ReferenceImage";

describe("selection page initial guidance", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
  });

  it("does not show the lifestyle and color validation before next is clicked", () => {
    const markup = renderToStaticMarkup(<Preference />);
    expect(markup).not.toContain("라이프스타일과 색상 톤을 선택해 주세요.");
    expect(markup).not.toContain('role="alert"');
  });

  it("does not show the interior style validation before next is clicked", () => {
    const markup = renderToStaticMarkup(<ReferenceImage />);
    expect(markup).not.toContain("인테리어 스타일을 선택해 주세요.");
    expect(markup).not.toContain('role="alert"');
  });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
