import type { FurnitureVisualType } from "../components/ui/furnitureVisualRegistry";
import {
  normalizeCanonicalFurnitureType,
  type CanonicalFurnitureType,
} from "./canonicalFurnitureType";

export const FURNITURE_SELECTION_CATEGORIES = [
  "전체",
  "침대",
  "소파",
  "책상/테이블",
  "의자",
  "선반",
  "책장 / 오픈 선반",
  "파티션",
  "수납",
  "전자기기",
  "조명/소품",
] as const;

export type FurnitureSelectionCategory = (typeof FURNITURE_SELECTION_CATEGORIES)[number];

export interface FurnitureSelectionItem {
  id: string;
  canonicalType: CanonicalFurnitureType;
  category: Exclude<FurnitureSelectionCategory, "전체">;
  name: string;
  visual: FurnitureVisualType;
}

export const FURNITURE_SELECTION_ITEMS = [
  { id: "bed", canonicalType: "bed", category: "침대", name: "침대", visual: "bed" },
  { id: "sofa-bed", canonicalType: "sofa_bed", category: "침대", name: "소파베드", visual: "sofaBed" },
  { id: "sofa", canonicalType: "sofa", category: "소파", name: "소파", visual: "sofa" },
  { id: "desk", canonicalType: "desk", category: "책상/테이블", name: "책상", visual: "desk" },
  { id: "nightstand", canonicalType: "nightstand", category: "책상/테이블", name: "협탁", visual: "nightstand" },
  { id: "side-table", canonicalType: "side_table", category: "책상/테이블", name: "사이드 테이블", visual: "sideTable" },
  { id: "multi-table", canonicalType: "multi_table", category: "책상/테이블", name: "다용도 테이블", visual: "table" },
  { id: "desk-chair", canonicalType: "desk_chair", category: "의자", name: "책상 의자", visual: "chair" },
  { id: "bookshelf", canonicalType: "bookshelf", category: "책장 / 오픈 선반", name: "책장 / 오픈 선반", visual: "bookshelf" },
  { id: "hanger", canonicalType: "hanger", category: "선반", name: "행거", visual: "hanger" },
  { id: "partition", canonicalType: "partition_shelf", category: "파티션", name: "파티션", visual: "partition" },
  { id: "wardrobe", canonicalType: "wardrobe", category: "수납", name: "옷장", visual: "wardrobe" },
  { id: "drawer", canonicalType: "drawer_chest", category: "수납", name: "서랍장", visual: "drawer" },
  { id: "tv-console", canonicalType: "media_console", category: "수납", name: "TV장 / 미디어 콘솔", visual: "tvStand" },
  { id: "monitor", canonicalType: "monitor", category: "전자기기", name: "모니터", visual: "monitor" },
  { id: "tv", canonicalType: "tv", category: "전자기기", name: "TV", visual: "tv" },
  { id: "mood-light", canonicalType: "mood_lamp", category: "조명/소품", name: "무드등", visual: "lamp" },
  { id: "rug", canonicalType: "rug", category: "조명/소품", name: "러그", visual: "rug" },
  { id: "plant", canonicalType: "plant", category: "조명/소품", name: "화분", visual: "plant" },
  { id: "mirror", canonicalType: "full_length_mirror", category: "조명/소품", name: "전신거울", visual: "mirror" },
  { id: "curtain", canonicalType: "curtain_blind", category: "조명/소품", name: "커튼 · 블라인드", visual: "curtain" },
] as const satisfies readonly FurnitureSelectionItem[];

export const FURNITURE_TYPE_BY_UI_ID: Readonly<Partial<Record<string, CanonicalFurnitureType>>> = Object.freeze(
  Object.fromEntries(FURNITURE_SELECTION_ITEMS.map((item) => [item.id, item.canonicalType])),
);

export function resolveFurnitureSelectionItemForCatalogProduct(
  product: { furnitureType: unknown },
): FurnitureSelectionItem | null {
  const canonicalType = normalizeCanonicalFurnitureType(product.furnitureType);
  if (canonicalType === null) return null;
  return FURNITURE_SELECTION_ITEMS.find((item) => item.canonicalType === canonicalType) ?? null;
}
