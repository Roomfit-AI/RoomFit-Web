// Curated shopping list for the rest-natural-wood ("네츄럴 톤") demo scenario
// — real 오늘의집 product links picked to match that scenario's furniture set
// (침대/화분/책상/소파/플로어 스탠드/책장/러그), shown as-is rather than
// derived from the room's actual furniture data since there's no product
// catalog/matching backend to look these up from (see the README note in
// LayoutConfirm.tsx on why this is scenario-scoped and static for now).
export interface ShoppingListEntry {
  name: string;
  url: string;
}

export const NATURAL_SCENARIO_SHOPPING_LIST: ShoppingListEntry[] = [
  { name: "침대", url: "https://store.ohou.se/goods/3744343" },
  { name: "화분", url: "https://store.ohou.se/goods/3712193" },
  { name: "책상", url: "https://store.ohou.se/goods/385796" },
  { name: "소파", url: "https://store.ohou.se/goods/3767257" },
  { name: "플로어 스탠드", url: "https://store.ohou.se/goods/1825491" },
  { name: "책장", url: "https://store.ohou.se/goods/180601" },
  { name: "러그", url: "https://store.ohou.se/goods/2766949" },
];
