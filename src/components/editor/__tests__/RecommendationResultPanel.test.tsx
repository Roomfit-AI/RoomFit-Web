import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RecommendationResultPanel from "../RecommendationResultPanel";

describe("recommendation FAILED result UI", () => {
  it("renders a normal feasibility result with retry guidance instead of a transport error", () => {
    const html = renderToStaticMarkup(<RecommendationResultPanel notice={{
      status: "FAILED",
      requestedFurnitureCount: 2,
      placedFurnitureCount: 0,
      unplacedFurniture: [{
        requestIndex: 0,
        furnitureType: "sofa_bed",
        reasonCode: "NO_VALID_BOUNDARY_PLACEMENT",
        message: "소파베드를 안전하게 배치할 수 없습니다.",
      }],
      warningCode: "INSUFFICIENT_ROOM_SPACE",
      message: "공간이 부족합니다.",
    }} onReturnToFurniture={() => undefined} />);

    expect(html).toContain("가구를 배치하지 못했어요");
    expect(html).toContain("요청 2개 중 0개 배치");
    expect(html).toContain("가구 선택으로 돌아가기");
    expect(html).not.toContain("서버에 연결하지 못했습니다");
  });
});
