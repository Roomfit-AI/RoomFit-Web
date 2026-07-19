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

// A shopping list is what the user still has to buy, so furniture that was
// already in the room before the recommendation does not belong in it.
//
// `status === "existing"` alone is not enough: ManageFurniture rewrites the
// status of *any* piece the user drags or rotates to "user_modified" (see
// markUserModified), so a pre-existing item would silently reappear here the
// moment it is nudged. The durable marker is the catalog productId — the
// backend only ever assigns one to furniture it recommended from the catalog,
// while scanned uploads and the seeded sample carry none. An item with no
// productId also has no product, price, or purchase link to show, so it was
// never actionable on a shopping list to begin with.
function isAlreadyOwned(item: Furniture): boolean {
  return item.status === "existing" || !item.productId?.trim();
}

export function buildShoppingListEntries(
  furniture: Furniture[],
  products: MockProductApiItem[],
): ShoppingListEntry[] {
  const productById = new Map(products.map((product) => [product.productId, product]));
  const entries = new Map<string, ShoppingListEntry>();

  for (const item of furniture) {
    if (item.status === "deleted") continue;
    if (isAlreadyOwned(item)) continue;

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
