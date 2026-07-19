import { apiClient } from "./client";

export interface MockProductApiItem {
  productId: string;
  variantId: string | null;
  type: string;
  name: string;
  brand: string | null;
  width: number;
  depth: number;
  height: number;
  price: number | null;
  styleTags: string[];
  imageUrl: string | null;
  purchaseUrl: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  } | null;
}

const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedProductCatalog {
  products: MockProductApiItem[];
  loadedAt: number;
}

const cachedProductsByBaseUrl = new Map<string, CachedProductCatalog>();
const productRequestsByBaseUrl = new Map<string, Promise<MockProductApiItem[]>>();

export async function fetchMockProducts(): Promise<MockProductApiItem[]> {
  const cacheKey = readApiBaseUrlCacheKey();
  const cached = cachedProductsByBaseUrl.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt <= PRODUCT_CACHE_TTL_MS) {
    return cached.products;
  }
  if (cached) cachedProductsByBaseUrl.delete(cacheKey);

  const pending = productRequestsByBaseUrl.get(cacheKey);
  if (pending) return pending;

  const request = apiClient
      .get<ApiResponse<MockProductApiItem[]>>("/api/products/mock")
      .then((response) => {
        if (!Array.isArray(response.data.data)) {
          throw new Error("Invalid mock product catalog response");
        }
        cachedProductsByBaseUrl.set(cacheKey, {
          products: response.data.data,
          loadedAt: Date.now(),
        });
        return response.data.data;
      });

  productRequestsByBaseUrl.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (productRequestsByBaseUrl.get(cacheKey) === request) {
      productRequestsByBaseUrl.delete(cacheKey);
    }
  }
}

function readApiBaseUrlCacheKey(): string {
  return String(apiClient.defaults.baseURL ?? "").trim().replace(/\/+$/, "");
}
