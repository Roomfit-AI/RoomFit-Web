import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FurnitureAdditionLimitDialog from "../FurnitureAdditionLimitDialog";

describe("FurnitureAdditionLimitDialog", () => {
  it("renders the exact accessible limit guidance", () => {
    const html = renderToStaticMarkup(<FurnitureAdditionLimitDialog onClose={() => undefined} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="furniture-addition-limit-title"');
    expect(html).toContain("현재 공간에 가구가 너무 많아요");
    expect(html).toContain("한 번에 최대 8개의 가구를 추가할 수 있으며,");
    expect(html).toContain("기존 가구를 포함해 전체 가구는 최대 12개까지 배치할 수 있습니다.");
    expect(html).toContain("선택한 가구 수를 줄인 뒤 다시 시도해 주세요.");
    expect(html).toContain("가구 다시 선택하기");
  });
});
