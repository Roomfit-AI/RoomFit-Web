import catalogDocument from "../data/furniture/catalog.json";
import type { Furniture, RoomLayout } from "../types";

export const LOFT_DESK_VARIANT_ID = "bed-loft-desk";
export const DESK_LOFT_CONFLICT_MESSAGE = "책상 수납 로프트 침대에는 책상 기능이 포함되어 있어 일반 책상과 함께 배치할 수 없습니다. 둘 중 하나만 선택해 주세요.";

// Catalog-backed fallback for legacy records that have no variantId. Current
// production catalog data always carries `variantId: bed-loft-desk`; this set
// deliberately avoids a broad prefix match that could classify a similar,
// unrelated product as a loft desk in the future.
const LOFT_DESK_PRODUCT_IDS = new Set(
  catalogDocument.products
    .filter((product) => product.variantId === LOFT_DESK_VARIANT_ID)
    .map((product) => product.productId),
);

export function isLoftDeskFurniture(item: Pick<Furniture, "variantId" | "productId">): boolean {
  return item.variantId === LOFT_DESK_VARIANT_ID
    || (item.variantId == null && item.productId != null && LOFT_DESK_PRODUCT_IDS.has(item.productId));
}

export function isDeskFurniture(item: Pick<Furniture, "category">): boolean {
  return item.category === "desk";
}

export function hasDeskLoftConflict(
  selectedIds: readonly string[],
  furniture: readonly Furniture[] = [],
): boolean {
  const activeFurniture = furniture.filter((item) => item.status !== "deleted");
  const hasLoft = selectedIds.includes(LOFT_DESK_VARIANT_ID) || activeFurniture.some(isLoftDeskFurniture);
  const hasDesk = selectedIds.includes("desk") || activeFurniture.some((item) => isDeskFurniture(item) && !isLoftDeskFurniture(item));
  return hasLoft && hasDesk;
}

export function getFurnitureSelectionBlockReason(
  selectionId: string,
  selectedIds: readonly string[],
  room: Pick<RoomLayout, "furniture" | "windows"> | null,
): string | null {
  if (selectionId === "curtain" && (!room || room.windows.length === 0)) {
    return "현재 공간에는 블라인드를 설치할 수 있는 창문이 없습니다.";
  }

  const furniture = (room?.furniture ?? []).filter((item) => item.status !== "deleted");
  const selectingLoft = selectionId === LOFT_DESK_VARIANT_ID;
  const selectingDesk = selectionId === "desk";
  const hasLoft = selectedIds.includes(LOFT_DESK_VARIANT_ID) || furniture.some(isLoftDeskFurniture);
  const hasDesk = selectedIds.includes("desk") || furniture.some((item) => isDeskFurniture(item) && !isLoftDeskFurniture(item));

  if ((selectingLoft && hasDesk) || (selectingDesk && hasLoft)) {
    return selectingLoft && furniture.some((item) => isDeskFurniture(item) && !isLoftDeskFurniture(item))
      ? "현재 공간에 책상이 있어 책상 수납 로프트 침대를 추가할 수 없습니다."
      : selectingDesk && furniture.some(isLoftDeskFurniture)
        ? "책상 수납 로프트 침대에 책상 기능이 포함되어 있어 별도의 책상을 추가할 수 없습니다."
        : DESK_LOFT_CONFLICT_MESSAGE;
  }
  return null;
}

export function parseStoredRoomLayout(raw: string | null): Pick<RoomLayout, "furniture" | "windows"> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<RoomLayout>;
    return Array.isArray(value.furniture) && Array.isArray(value.windows)
      ? { furniture: value.furniture, windows: value.windows }
      : null;
  } catch {
    return null;
  }
}
