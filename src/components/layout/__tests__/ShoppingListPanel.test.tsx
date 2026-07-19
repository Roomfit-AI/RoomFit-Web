import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MockProductApiItem } from "../../../api/products";
import { buildShoppingListEntries, toSafePurchaseUrl } from "../../../config/shoppingList";
import type { Furniture } from "../../../types";
import ShoppingListPanel from "../ShoppingListPanel";

describe("dynamic shopping list", () => {
  it("matches exact productId, excludes deleted furniture, and groups duplicate products", () => {
    const entries = buildShoppingListEntries([
      furniture("desk-a", "desk-compact-01"),
      furniture("desk-b", "desk-compact-01"),
      furniture("deleted-sofa", "sofa-01", "deleted"),
      furniture("rug", "rug-01", "recommended", "rug"),
    ], [
      product("desk-compact-01", "https://example.com/desk"),
      product("desk-compact-010", "https://example.com/wrong-partial-match"),
      product("sofa-01", "https://example.com/deleted"),
      product("rug-01", null),
    ]);

    expect(entries.map((entry) => entry.productId)).toEqual(["desk-compact-01", "rug-01"]);
    expect(entries[0]).toMatchObject({ quantity: 2, purchaseUrl: "https://example.com/desk" });
    expect(entries[1]).toMatchObject({ quantity: 1, purchaseUrl: null });
    expect(entries.some((entry) => entry.purchaseUrl?.includes("partial"))).toBe(false);
    expect(entries.some((entry) => entry.productId === "sofa-01")).toBe(false);
  });

  it("leaves furniture the room already had out of the list, even after the user moves it", () => {
    const entries = buildShoppingListEntries([
      furniture("scanned-bed", null, "existing", "bed"),
      // Dragging or rotating any piece rewrites its status to "user_modified"
      // (ManageFurniture's markUserModified), so an already-owned item must stay
      // out on the strength of its missing catalog productId alone.
      furniture("scanned-wardrobe-moved", null, "user_modified", "cabinet"),
      furniture("recommended-desk", "desk-compact-01"),
    ], [product("desk-compact-01", "https://example.com/desk")]);

    expect(entries.map((entry) => entry.productId)).toEqual(["desk-compact-01"]);
  });

  it("renders real links safely and keeps unavailable current furniture without dead anchors", () => {
    const html = renderToStaticMarkup(
      <ShoppingListPanel
        furniture={[
          furniture("desk-a", "desk-compact-01"),
          furniture("desk-b", "desk-compact-01"),
          furniture("rug", "rug-01", "recommended", "rug"),
          furniture("unknown", "unknown-01"),
        ]}
        products={[
          product("desk-compact-01", "https://example.com/desk"),
          product("rug-01", null),
        ]}
        status="success"
        onRetry={vi.fn()}
      />,
    );

    expect(html).toContain('href="https://example.com/desk"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("컴팩트 책상 × 2");
    expect(html).toContain('data-product-id="rug-01"');
    expect(html).toContain('data-product-id="unknown-01"');
    expect(html.match(/aria-label="[^"]+, 구매 링크 준비 중"/g)).toHaveLength(2);
    expect(html).not.toContain('href="#"');
  });

  it("rejects non-HTTP purchase schemes instead of rendering executable links", () => {
    expect(toSafePurchaseUrl("javascript:alert(1)")).toBeNull();
    expect(toSafePurchaseUrl("data:text/html,bad")).toBeNull();
    expect(toSafePurchaseUrl("not a url")).toBeNull();
    expect(toSafePurchaseUrl("http://example.com/item")).toBe("http://example.com/item");
  });

  it("renders distinct loading, error/retry, and empty-layout states", () => {
    const onRetry = vi.fn();
    const loading = renderPanel([], [], "loading");
    const errorPanel = ShoppingListPanel({ furniture: [], products: [], status: "error", onRetry });
    const error = renderToStaticMarkup(errorPanel);
    const empty = renderPanel([], [], "success");

    expect(loading).toContain('role="status"');
    expect(loading).toContain("불러오는 중");
    expect(error).toContain('role="alert"');
    expect(error).toContain("다시 시도");
    errorPanel.props.children[1].props.onClick();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(empty).toContain("현재 배치에 쇼핑할 가구가 없습니다");
  });

  it("uses only the latest current/private Layout furniture", () => {
    const privateLayout = renderPanel(
      [furniture("private-desk", "desk-compact-01")],
      [
        product("desk-compact-01", "https://example.com/private"),
        product("public-bed-01", "https://example.com/public"),
      ],
      "success",
    );
    const changedLayout = renderPanel(
      [furniture("new-rug", "rug-01", "recommended", "rug")],
      [product("rug-01", "https://example.com/rug")],
      "success",
    );

    expect(privateLayout).toContain("https://example.com/private");
    expect(privateLayout).not.toContain("https://example.com/public");
    expect(changedLayout).toContain("https://example.com/rug");
    expect(changedLayout).not.toContain("https://example.com/private");
  });
});

function renderPanel(
  furnitureItems: Furniture[],
  products: MockProductApiItem[],
  status: "loading" | "success" | "error",
): string {
  return renderToStaticMarkup(
    <ShoppingListPanel furniture={furnitureItems} products={products} status={status} onRetry={vi.fn()} />,
  );
}

function furniture(
  id: string,
  productId: string | null,
  status: Furniture["status"] = "recommended",
  category: Furniture["category"] = "desk",
): Furniture {
  return {
    id,
    productId,
    name: id,
    category,
    dimensions: { width: 1, depth: 1, height: 1 },
    position: { x: 0, z: 0 },
    rotationY: 0,
    color: "#fff",
    material: "wood",
    status,
    removable: true,
  };
}

function product(productId: string, purchaseUrl: string | null): MockProductApiItem {
  return {
    productId,
    variantId: productId.replace(/-01$/, ""),
    type: "desk",
    name: productId === "desk-compact-01" ? "컴팩트 책상" : productId,
    brand: "RoomFit",
    width: 1,
    depth: 1,
    height: 1,
    price: 89000,
    styleTags: [],
    imageUrl: null,
    purchaseUrl,
  };
}
