import { describe, expect, it } from "vitest";

import {
  FurnitureAdditionRequestError,
  getFurnitureAdditionErrorMessage,
} from "../furnitureAdditionError";

describe("furniture addition error UX", () => {
  it("keeps placement, network, and server failures distinct", () => {
    const placement = getFurnitureAdditionErrorMessage(new FurnitureAdditionRequestError("PLACEMENT_REJECTED"));
    const network = getFurnitureAdditionErrorMessage(new FurnitureAdditionRequestError("NETWORK"));
    const server = getFurnitureAdditionErrorMessage(new FurnitureAdditionRequestError("SERVER"));

    expect(placement).toContain("가구 수를 줄이거나");
    expect(network).toContain("네트워크 연결");
    expect(server).toContain("서버에서 요청을 처리하지 못했습니다");
    expect(new Set([placement, network, server]).size).toBe(3);
  });
});
