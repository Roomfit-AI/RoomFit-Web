import { afterEach, describe, expect, it, vi } from "vitest";

describe("mock product catalog adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("loads the existing product catalog endpoint without changing client scope", async () => {
    const { apiClient, fetchMockProducts } = await loadAdapter();
    const products = [product("desk-compact-01")];
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { success: true, data: products, error: null },
    });

    await expect(fetchMockProducts()).resolves.toEqual(products);
    await expect(fetchMockProducts()).resolves.toEqual(products);
    expect(get).toHaveBeenCalledExactlyOnceWith("/api/products/mock");
  });

  it("retries with a new request after a catalog failure", async () => {
    const { apiClient, fetchMockProducts } = await loadAdapter();
    const products = [product("desk-compact-01")];
    const get = vi.spyOn(apiClient, "get")
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ data: { success: true, data: products, error: null } });

    await expect(fetchMockProducts()).rejects.toThrow("network unavailable");
    await expect(fetchMockProducts()).resolves.toEqual(products);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("does not reuse a successful catalog across different API base URLs", async () => {
    const { apiClient, fetchMockProducts } = await loadAdapter();
    const first = [product("catalog-a")];
    const second = [product("catalog-b")];
    const get = vi.spyOn(apiClient, "get")
      .mockResolvedValueOnce({ data: { success: true, data: first, error: null } })
      .mockResolvedValueOnce({ data: { success: true, data: second, error: null } });

    apiClient.defaults.baseURL = "https://api-a.example";
    await expect(fetchMockProducts()).resolves.toEqual(first);
    apiClient.defaults.baseURL = "https://api-b.example";
    await expect(fetchMockProducts()).resolves.toEqual(second);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("refreshes a successful catalog after the bounded cache lifetime", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
    const { apiClient, fetchMockProducts } = await loadAdapter();
    const first = [product("catalog-a")];
    const second = [product("catalog-b")];
    const get = vi.spyOn(apiClient, "get")
      .mockResolvedValueOnce({ data: { success: true, data: first, error: null } })
      .mockResolvedValueOnce({ data: { success: true, data: second, error: null } });

    await expect(fetchMockProducts()).resolves.toEqual(first);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await expect(fetchMockProducts()).resolves.toEqual(second);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

async function loadAdapter() {
  vi.resetModules();
  const [{ apiClient }, { fetchMockProducts }] = await Promise.all([
    import("../client"),
    import("../products"),
  ]);
  return { apiClient, fetchMockProducts };
}

function product(productId: string) {
  return {
    productId,
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
  };
}
