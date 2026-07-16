import type { ComponentType, SVGProps } from "react";

import {
  Bed,
  Bookshelf,
  Chair,
  Curtain,
  Desk,
  Drawer,
  Hanger,
  Lamp,
  Mirror,
  Monitor,
  Nightstand,
  Partition,
  Plant,
  Rug,
  SideTable,
  Sofa,
  SofaBed,
  Table,
  Tv,
  TvStand,
  Wardrobe,
} from "./FurnitureVisuals";

export type FurnitureVisualType =
  | "bed"
  | "sofaBed"
  | "sofa"
  | "nightstand"
  | "sideTable"
  | "table"
  | "desk"
  | "chair"
  | "bookshelf"
  | "hanger"
  | "partition"
  | "wardrobe"
  | "drawer"
  | "tvStand"
  | "monitor"
  | "tv"
  | "lamp"
  | "rug"
  | "plant"
  | "mirror"
  | "curtain";

type VisualComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const furnitureVisuals: Record<FurnitureVisualType, VisualComponent> = {
  bed: Bed, sofaBed: SofaBed, sofa: Sofa, nightstand: Nightstand,
  sideTable: SideTable, table: Table, desk: Desk, chair: Chair,
  bookshelf: Bookshelf, hanger: Hanger, partition: Partition,
  wardrobe: Wardrobe, drawer: Drawer, tvStand: TvStand, monitor: Monitor,
  tv: Tv, lamp: Lamp, rug: Rug, plant: Plant, mirror: Mirror, curtain: Curtain,
};
