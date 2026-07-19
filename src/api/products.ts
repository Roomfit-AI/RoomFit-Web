import { apiClient } from "./client";

export interface MockProductApiItem {
  productId: string;
  variantId: string | null;
  type: string;
  name: string;
  brand: string | null;
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

// The full mock/generated product catalog, including purchaseUrl -- used to
// resolve a room's actually-recommended furniture (matched by productId)
// into real shopping links, instead of a hardcoded per-scenario list.
export async function fetchMockProducts(): Promise<MockProductApiItem[]> {
  const response = await apiClient.get<ApiResponse<MockProductApiItem[]>>("/api/products/mock");
  return response.data.data;
}
