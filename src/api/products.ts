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

let cachedProducts: MockProductApiItem[] | null = null;
let productRequest: Promise<MockProductApiItem[]> | null = null;

export async function fetchMockProducts(): Promise<MockProductApiItem[]> {
  if (cachedProducts) return cachedProducts;
  if (!productRequest) {
    productRequest = apiClient
      .get<ApiResponse<MockProductApiItem[]>>("/api/products/mock")
      .then((response) => {
        if (!Array.isArray(response.data.data)) {
          throw new Error("Invalid mock product catalog response");
        }
        cachedProducts = response.data.data;
        return cachedProducts;
      })
      .finally(() => {
        productRequest = null;
      });
  }
  return productRequest;
}
