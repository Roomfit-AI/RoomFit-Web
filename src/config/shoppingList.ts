import type { MockProductApiItem } from "../api/products";
import type { Furniture, FurnitureCategory } from "../types";

export interface ShoppingListEntry {
  key: string;
  productId: string | null;
  name: string;
  category: FurnitureCategory;
  quantity: number;
  brand: string | null;
  price: number | null;
  purchaseUrl: string | null;
}

export function buildShoppingListEntries(
  furniture: Furniture[],
  products: MockProductApiItem[],
): ShoppingListEntry[] {
  const productById = new Map(products.map((product) => [product.productId, product]));
  const entries = new Map<string, ShoppingListEntry>();

  for (const item of furniture) {
    if (item.status === "deleted") continue;

    const productId = item.productId?.trim() || null;
    const key = productId ? `product:${productId}` : `furniture:${item.id}`;
    const existing = entries.get(key);
    if (existing) {
      existing.quantity += 1;
      continue;
    }

    const product = productId ? productById.get(productId) : undefined;
    entries.set(key, {
      key,
      productId,
      name: product?.name || item.name,
      category: item.category,
      quantity: 1,
      brand: product?.brand ?? null,
      price: product?.price ?? null,
      purchaseUrl: toSafePurchaseUrl(product?.purchaseUrl),
    });
  }

  return Array.from(entries.values());
}

export function toSafePurchaseUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}
