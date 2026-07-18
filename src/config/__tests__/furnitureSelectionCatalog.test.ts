import { describe, expect, it } from "vitest";
import catalogDocument from "../../data/furniture/catalog.json";

import { CANONICAL_FURNITURE_TYPES } from "../canonicalFurnitureType";
import {
  FURNITURE_SELECTION_ITEMS,
  FURNITURE_TYPE_BY_UI_ID,
  resolveFurnitureSelectionItemForCatalogProduct,
} from "../furnitureSelectionCatalog";
import { resolveRequiredFurnitureTypes } from "../../api/agentContextRequest";

describe("furniture selection catalog", () => {
  it("covers every canonical type exactly once", () => {
    expect(FURNITURE_SELECTION_ITEMS).toHaveLength(21);
    expect(new Set(Object.values(FURNITURE_TYPE_BY_UI_ID))).toEqual(
      new Set(CANONICAL_FURNITURE_TYPES),
    );
  });

  it("keeps bookshelf and partition_shelf in separate UI groups", () => {
    const byType = new Map(FURNITURE_SELECTION_ITEMS.map((item) => [item.canonicalType, item]));
    expect(byType.get("bookshelf")).toMatchObject({
      category: "책장 / 오픈 선반",
      name: "책장 / 오픈 선반",
    });
    expect(byType.get("partition_shelf")).toMatchObject({
      category: "파티션",
      name: "파티션",
    });
    expect(byType.get("bookshelf")?.category)
      .not.toBe(byType.get("partition_shelf")?.category);
  });

  it.each([
    ["bookshelf-double-open", "bookshelf", "책장 / 오픈 선반"],
    ["partition-shelf-kallax", "partition_shelf", "파티션"],
    ["partition-shelf-slim", "partition_shelf", "파티션"],
    ["partition-shelf-storage", "partition_shelf", "파티션"],
    ["partition-shelf-translucent", "partition_shelf", "파티션"],
  ])("classifies catalog variant %s from its canonical furnitureType", (
    variantId,
    canonicalType,
    category,
  ) => {
    const product = catalogDocument.products.find((item) => item.variantId === variantId);
    expect(product).toBeDefined();

    const selectionItem = resolveFurnitureSelectionItemForCatalogProduct(product!);
    expect(selectionItem).toMatchObject({ canonicalType, category });
  });

  it("classifies every bookshelf and partition product by catalog furnitureType, not IDs", () => {
    const relevantProducts = catalogDocument.products.filter((product) => (
      product.furnitureType === "bookshelf" || product.furnitureType === "partition_shelf"
    ));

    expect(relevantProducts.length).toBeGreaterThan(0);
    for (const product of relevantProducts) {
      const selectionItem = resolveFurnitureSelectionItemForCatalogProduct(product);
      expect(selectionItem?.canonicalType).toBe(product.furnitureType);
      expect(selectionItem?.category).toBe(
        product.furnitureType === "bookshelf" ? "책장 / 오픈 선반" : "파티션",
      );
    }

    const misleadingIds = {
      furnitureType: "bookshelf",
      productId: "partition-shelf-storage-01",
      variantId: "partition-shelf-storage",
    };
    expect(resolveFurnitureSelectionItemForCatalogProduct(misleadingIds))
      .toMatchObject({ canonicalType: "bookshelf", category: "책장 / 오픈 선반" });
  });

  it("sends bookshelf and partition selections as their separate canonical types", () => {
    const bookshelf = resolveFurnitureSelectionItemForCatalogProduct(
      catalogDocument.products.find((item) => item.variantId === "bookshelf-double-open")!,
    );
    const partition = resolveFurnitureSelectionItemForCatalogProduct(
      catalogDocument.products.find((item) => item.variantId === "partition-shelf-storage")!,
    );

    expect(resolveRequiredFurnitureTypes([bookshelf?.id, partition?.id]))
      .toEqual(["bookshelf", "partition_shelf"]);
  });
});
