import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../client";
import { fetchMockProducts } from "../products";

describe("mock product catalog adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the existing product catalog endpoint without changing client scope", async () => {
    const products = [{
      productId: "desk-compact-01",
      variantId: "desk-compact",
      type: "desk",
      name: "컴팩트 책상",
      brand: "RoomFit",
      width: 1.2,
      depth: 0.6,
      height: 0.72,
      price: 89000,
      styleTags: ["minimal"],
      imageUrl: null,
      purchaseUrl: "https://example.com/desk",
    }];
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { success: true, data: products, error: null },
    });

    await expect(fetchMockProducts()).resolves.toEqual(products);
    await expect(fetchMockProducts()).resolves.toEqual(products);
    expect(get).toHaveBeenCalledExactlyOnceWith("/api/products/mock");
  });
});
