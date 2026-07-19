import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Navbar from "../Navbar";

describe("Navbar onboarding labels", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage({
      "roomfit:selectedAdditionalFurnitureIds": '["desk"]',
    }));
    vi.stubGlobal("sessionStorage", memoryStorage());
  });

  it("keeps the furniture selection action as next step instead of starting recommendation", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/add-furniture"]}>
        <Navbar />
      </MemoryRouter>,
    );
    expect(markup).toContain("다음 단계");
    expect(markup).not.toContain("추천 생성 중...");
  });

  it("leaves recommendation generation to the dedicated in-page CTA", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/recommendation"]}>
        <Navbar />
      </MemoryRouter>,
    );
    expect(markup).toContain("이전 단계");
    expect(markup).not.toContain("다음 단계");
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
