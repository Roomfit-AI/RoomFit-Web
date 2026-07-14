// Curated shopping list for the rest-natural-wood ("네츄럴 톤") demo scenario
// — real 오늘의집 product links picked to match that scenario's furniture set
// (침대/화분/책상/소파/플로어 스탠드/책장/러그), shown as-is rather than
// derived from the room's actual furniture data since there's no product
// catalog/matching backend to look these up from (see the README note in
// LayoutConfirm.tsx on why this is scenario-scoped and static for now).
export interface ShoppingListEntry {
  name: string;
  url: string;
  // Key into the ICONS map in LayoutConfirm.tsx — single-glyph icons, always
  // centered within their own viewBox by design. An earlier version reused
  // the .furniture-card-* CSS illustrations (see components/ui/
  // FurnitureVisual), but those were hand-drawn to fill a 110x82 "card"
  // canvas with each shape's "ink" sitting in a different sub-region (e.g.
  // the rug's oval sits high, the bed's headboard sits left) — scaling that
  // down into a uniform square thumbnail preserved each shape's position
  // *within its own canvas*, not a shared center, so the icons visibly
  // didn't line up row to row.
  iconKey: string;
  // Short, accurate category label — not a price/spec, since those would be
  // fabricated data sitting next to a real purchase link.
  info: string;
}

export const NATURAL_SCENARIO_SHOPPING_LIST: ShoppingListEntry[] = [
  { name: "침대", url: "https://store.ohou.se/goods/3744343", iconKey: "bed", info: "침실 가구" },
  { name: "화분", url: "https://store.ohou.se/goods/3712193", iconKey: "plant", info: "식물 / 소품" },
  { name: "책상", url: "https://store.ohou.se/goods/385796", iconKey: "desk", info: "책상 / 테이블" },
  { name: "소파", url: "https://store.ohou.se/goods/3767257", iconKey: "sofa", info: "소파" },
  { name: "플로어 스탠드", url: "https://store.ohou.se/goods/1825491", iconKey: "lamp", info: "조명" },
  { name: "책장", url: "https://store.ohou.se/goods/180601", iconKey: "bookshelf", info: "수납장" },
  { name: "러그", url: "https://store.ohou.se/goods/2766949", iconKey: "rug", info: "러그" },
];
