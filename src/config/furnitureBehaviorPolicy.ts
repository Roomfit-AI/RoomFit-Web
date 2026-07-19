import type { PreferredColorToneId } from "./preferredColorTone";

export type ThemeColorSlot = "primary" | "secondary" | "accent" | "neutral" | "emissive" | "preserve";
export type FurnitureCollisionMode = "SOLID" | "FLOOR_OVERLAY";
export type FurnitureAnchorMode = "FREE" | "WINDOW";

export interface ThemePalette {
  primary: readonly string[];
  secondary: readonly string[];
  accent: readonly string[];
  neutral: readonly string[];
  wood: readonly string[];
  emissive: readonly string[];
}

export interface ThemeTarget {
  slot: ThemeColorSlot;
  /** A stable palette entry; omitted entries use a stable part-name hash. */
  index?: number;
}

export interface FurnitureBehaviorPolicy {
  variantId: string;
  targets?: Readonly<Record<string, ThemeTarget>>;
  exclusiveWith?: { canonicalTypes?: readonly string[]; variantIds?: readonly string[] };
  collisionMode?: FurnitureCollisionMode;
  anchorMode?: FurnitureAnchorMode;
}

// Palette entries deliberately have close value/chroma so a room feels coherent
// while still allowing the fabric parts to read as separate materials.
export const THEME_PALETTES: Readonly<Record<PreferredColorToneId, ThemePalette>> = {
  ivory: {
    primary: ["#F3EEE4", "#E9E1D5"], secondary: ["#D9CCBB", "#C9C5BD"],
    accent: ["#4B4B4A", "#817A70"], neutral: ["#F7F5F0", "#D5D2CC"],
    wood: ["#B08A64", "#826247"], emissive: ["#FFE4A8"],
  },
  beige: {
    primary: ["#D8C5A7", "#CDB18A"], secondary: ["#E9DCC7", "#B99C78"],
    accent: ["#70533D", "#9B7250"], neutral: ["#F1E8DB", "#C8B8A5"],
    wood: ["#A9784D", "#70492F"], emissive: ["#FFD9A0"],
  },
  gray: {
    primary: ["#B9B8B3", "#9FA3A2"], secondary: ["#D1CFCA", "#7E8586"],
    accent: ["#454A4C", "#687176"], neutral: ["#EEEDE9", "#BFC0BC"],
    wood: ["#8A7867", "#5E544C"], emissive: ["#F5D9A7"],
  },
  brown: {
    primary: ["#9B7253", "#B58A5D"], secondary: ["#D2B98D", "#E5D6C2"],
    accent: ["#573D2D", "#704B34"], neutral: ["#EDE2D2", "#B9A896"],
    wood: ["#8A5A36", "#4D3427"], emissive: ["#FFE0A3"],
  },
  green: {
    primary: ["#83977B", "#657A63"], secondary: ["#A8AD7E", "#76928E"],
    accent: ["#3E5540", "#59643A"], neutral: ["#E6DDCB", "#C9C3AE"],
    wood: ["#805E3E", "#4C392D"], emissive: ["#F8DCA1"],
  },
  blue: {
    primary: ["#4E6382", "#7089A0"], secondary: ["#9DB4C3", "#687C96"],
    accent: ["#28394F", "#465563"], neutral: ["#EEE9DF", "#C4C7C8"],
    wood: ["#805E43", "#4A3B34"], emissive: ["#FFE1AA"],
  },
  pink: {
    primary: ["#C98F9A", "#D9A9AF"], secondary: ["#E6C1B9", "#B57B83"],
    accent: ["#8A5962", "#A85F57"], neutral: ["#F0E3DD", "#CDBDB8"],
    wood: ["#91674B", "#533E31"], emissive: ["#FFDAAB"],
  },
  black: {
    primary: ["#36383A", "#4A4744"], secondary: ["#74706B", "#96918B"],
    accent: ["#17191C", "#5C4638"], neutral: ["#DDD8D0", "#AAA7A1"],
    wood: ["#684B36", "#382D29"], emissive: ["#F4D49A"],
  },
};

const primary = (index?: number): ThemeTarget => ({ slot: "primary", index });
const secondary = (index?: number): ThemeTarget => ({ slot: "secondary", index });
const accent = (index?: number): ThemeTarget => ({ slot: "accent", index });
const neutral = (index?: number): ThemeTarget => ({ slot: "neutral", index });

const BED_TARGETS = {
  "pillow-left": primary(1), "pillow-right": secondary(0), blanket: primary(0), runner: accent(0),
  "fabric-headboard": neutral(0), "headboard-inset": secondary(1), "teal-headboard": primary(0),
  "teal-runner": accent(0), "loft-pillow": secondary(0), "wardrobe-door": neutral(1),
} as const;
const SOFA_TARGETS = {
  "seat-base": primary(0), "seat-cushion": primary(1), "seat-cushion-left": primary(0),
  "seat-cushion-center": secondary(0), "seat-cushion-right": primary(1), "back-cushion": secondary(0),
  "back-cushion-left": secondary(0), "back-cushion-center": primary(1), "back-cushion-right": accent(0),
  "back-cushion-1": secondary(0), "back-cushion-2": accent(0), "front-roll": secondary(0),
  bolster: accent(0), "pillow-left": primary(1), "pillow-right": secondary(0),
} as const;
const RUG_TARGETS = {
  "rect-base": primary(0), "rect-inset": secondary(0), "round-base": primary(0), "round-inset": secondary(0),
  "runner-base": primary(0), "runner-inset": secondary(0), "stripe-front": accent(0), "stripe-back": secondary(1),
  "geometric-base": primary(0), "diamond-teal": secondary(0), "diamond-orange": accent(0),
  "diamond-dark": accent(1), "diamond-warm": secondary(1),
} as const;

export const FURNITURE_BEHAVIOR_POLICIES: Readonly<Record<string, FurnitureBehaviorPolicy>> = {
  "bed-low-platform": { variantId: "bed-low-platform", targets: { pillow: secondary(0), runner: accent(0) } },
  "bed-fabric-headboard": { variantId: "bed-fabric-headboard", targets: BED_TARGETS },
  "bed-storage": { variantId: "bed-storage", targets: BED_TARGETS },
  "bed-midcentury-teal": { variantId: "bed-midcentury-teal", targets: BED_TARGETS },
  "bed-classic-idanaes": { variantId: "bed-classic-idanaes", targets: BED_TARGETS },
  "bed-loft-desk": { variantId: "bed-loft-desk", targets: BED_TARGETS, exclusiveWith: { canonicalTypes: ["desk"] } },
  "desk-compact": { variantId: "desk-compact", targets: { top: secondary(0) } },
  "desk-storage": { variantId: "desk-storage", targets: { "drawer-1": secondary(0), "drawer-2": primary(1), "drawer-3": accent(0) } },
  "desk-corner": { variantId: "desk-corner", targets: { "left-cabinet-door": secondary(0) } },
  "chair-basic": { variantId: "chair-basic", targets: { seat: primary(0), backrest: secondary(0) } },
  "chair-compact-swivel": { variantId: "chair-compact-swivel", targets: { "seat-pad": primary(0), "shell-back": secondary(0) } },
  "chair-armrest": { variantId: "chair-armrest", targets: { "seat-base": primary(0), "mesh-back": secondary(0), "arm-pad-left": accent(0), "arm-pad-right": accent(0) } },
  "chair-gaming-matchspel": { variantId: "chair-gaming-matchspel", targets: { "seat-pad": primary(0), "mesh-back": secondary(0), headrest: accent(0) } },
  "sofa-two-seat": { variantId: "sofa-two-seat", targets: SOFA_TARGETS },
  "sofa-single": { variantId: "sofa-single", targets: SOFA_TARGETS },
  "sofa-modular": { variantId: "sofa-modular", targets: SOFA_TARGETS },
  "sofa-classic-ektorp": { variantId: "sofa-classic-ektorp", targets: SOFA_TARGETS },
  "sofa-bed-compact": { variantId: "sofa-bed-compact", targets: { "seat-mattress": primary(0), "back-mattress": secondary(0), "front-skirt": accent(0) } },
  "sofa-bed-folding": { variantId: "sofa-bed-folding", targets: { "seat-mattress": primary(0), "back-mattress": secondary(0) } },
  "sofa-bed-daybed": { variantId: "sofa-bed-daybed", targets: SOFA_TARGETS },
  "sofa-bed-classic-storage": { variantId: "sofa-bed-classic-storage", targets: SOFA_TARGETS },
  "sofa-bed-midcentury-orange": { variantId: "sofa-bed-midcentury-orange", targets: SOFA_TARGETS },
  "bookshelf-classic-havsta": { variantId: "bookshelf-classic-havsta", targets: { "back-panel": neutral(0), "door-outer-left": secondary(0), "door-outer-right": secondary(1) } },
  "partition-shelf-translucent": { variantId: "partition-shelf-translucent", targets: { "panel-left": primary(0), "panel-center": secondary(0), "panel-right": accent(0) } },
  "wardrobe-hinged": { variantId: "wardrobe-hinged", targets: { "door-left": primary(0), "door-right": secondary(0) } },
  "wardrobe-sliding": { variantId: "wardrobe-sliding", targets: { "sliding-door-left": primary(0), "sliding-door-right": secondary(0) } },
  "wardrobe-classic-gullaberg": { variantId: "wardrobe-classic-gullaberg", targets: { "door-left": primary(0), "door-right": secondary(0), "drawer-left": accent(0), "drawer-right": accent(0) } },
  "drawer-chest-vertical": { variantId: "drawer-chest-vertical", targets: { "drawer-1": primary(0), "drawer-2": secondary(0), "drawer-3": primary(1), "drawer-4": secondary(1), "drawer-5": accent(0) } },
  "drawer-chest-low-wide": { variantId: "drawer-chest-low-wide", targets: { "drawer-left-upper": primary(0), "drawer-right-upper": secondary(0), "drawer-left-middle": primary(1), "drawer-right-middle": secondary(1), "drawer-left-lower": accent(0), "drawer-right-lower": accent(0) } },
  "drawer-chest-bedside": { variantId: "drawer-chest-bedside", targets: { "compact-drawer-upper": primary(0), "compact-drawer-lower": secondary(0) } },
  "drawer-chest-classic-gullaberg": { variantId: "drawer-chest-classic-gullaberg", targets: { "drawer-1-1": primary(0), "drawer-1-2": secondary(0), "drawer-2-1": primary(1), "drawer-2-2": secondary(1), "drawer-3-1": accent(0), "drawer-3-2": accent(0) } },
  "rug-rectangular": { variantId: "rug-rectangular", targets: RUG_TARGETS, collisionMode: "FLOOR_OVERLAY" },
  "rug-round": { variantId: "rug-round", targets: RUG_TARGETS, collisionMode: "FLOOR_OVERLAY" },
  "rug-runner": { variantId: "rug-runner", targets: RUG_TARGETS, collisionMode: "FLOOR_OVERLAY" },
  "rug-geometric": { variantId: "rug-geometric", targets: RUG_TARGETS, collisionMode: "FLOOR_OVERLAY" },
  "lamp-table": { variantId: "lamp-table", targets: { "table-shade": accent(0) } },
  "lamp-floor": { variantId: "lamp-floor", targets: { "floor-shade": secondary(0) } },
  "blind-roller": { variantId: "blind-roller", targets: { "roller-panel": primary(0), "roller-pull-cord": secondary(0) }, anchorMode: "WINDOW" },
  "blind-wood": { variantId: "blind-wood", targets: { "wood-pull-cord": secondary(0) }, anchorMode: "WINDOW" },
};

export function getFurnitureBehaviorPolicy(variantId: string | null | undefined): FurnitureBehaviorPolicy | null {
  return variantId ? FURNITURE_BEHAVIOR_POLICIES[variantId] ?? null : null;
}

export function getThemeTarget(variantId: string, partId: string): ThemeTarget | null {
  return getFurnitureBehaviorPolicy(variantId)?.targets?.[partId] ?? null;
}

export function getThemeColor(
  tone: PreferredColorToneId,
  target: ThemeTarget,
  stableKey: string,
): string | null {
  if (target.slot === "preserve") return null;
  const palette = THEME_PALETTES[tone];
  const colors = target.slot === "emissive"
    ? palette.emissive
    : palette[target.slot];
  if (!colors?.length) return null;
  const index = target.index ?? stableIndex(stableKey, colors.length);
  return colors[index % colors.length];
}

export function resolveFurnitureCollisionMode(variantId: string | null | undefined, category?: string): FurnitureCollisionMode {
  return getFurnitureBehaviorPolicy(variantId)?.collisionMode ?? (category === "rug" ? "FLOOR_OVERLAY" : "SOLID");
}

function stableIndex(value: string, length: number): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}
