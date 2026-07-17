export type PreferredColorToneId =
  | "ivory"
  | "beige"
  | "gray"
  | "brown"
  | "green"
  | "blue"
  | "pink"
  | "black";

export type PreferredColorToneApiValue =
  | "WHITE_IVORY"
  | "BEIGE_SAND"
  | "GRAY"
  | "BROWN_WOOD"
  | "GREEN_OLIVE"
  | "BLUE_NAVY"
  | "PINK_CORAL"
  | "BLACK_DARK";

export interface PreferredColorToneOption {
  id: PreferredColorToneId;
  label: string;
  colors: readonly string[];
}

export const PREFERRED_COLOR_TONE_OPTIONS = [
  { id: "ivory", label: "화이트 / 아이보리", colors: ["#ffffff", "#f0e6d2"] },
  { id: "beige", label: "베이지 / 샌드", colors: ["#d9c8ad", "#e3cba0"] },
  { id: "gray", label: "그레이", colors: ["#b9b9b9"] },
  { id: "brown", label: "브라운 / 우드", colors: ["#6b4a35", "#b08968"] },
  { id: "green", label: "그린 / 올리브", colors: ["#3f6b44", "#6b6b3f"] },
  { id: "blue", label: "블루 / 네이비", colors: ["#3a5a8c", "#152238"] },
  { id: "pink", label: "핑크 / 코랄", colors: ["#f0b8c8", "#e8735a"] },
  { id: "black", label: "블랙 / 다크", colors: ["#0a0a0a", "#2b2b2b"] },
] as const satisfies readonly PreferredColorToneOption[];

export const PREFERRED_COLOR_TONE_API_VALUES: Record<
  PreferredColorToneId,
  PreferredColorToneApiValue
> = {
  ivory: "WHITE_IVORY",
  beige: "BEIGE_SAND",
  gray: "GRAY",
  brown: "BROWN_WOOD",
  green: "GREEN_OLIVE",
  blue: "BLUE_NAVY",
  pink: "PINK_CORAL",
  black: "BLACK_DARK",
};

const preferredColorToneIds = new Set<string>(
  PREFERRED_COLOR_TONE_OPTIONS.map(({ id }) => id),
);

export function isPreferredColorToneId(value: unknown): value is PreferredColorToneId {
  return typeof value === "string" && preferredColorToneIds.has(value);
}

export function normalizePreferredColorToneId(value: unknown): PreferredColorToneId | null {
  return isPreferredColorToneId(value) ? value : null;
}

export function toPreferredColorToneApiValue(value: unknown): PreferredColorToneApiValue | null {
  const normalized = normalizePreferredColorToneId(value);
  return normalized ? PREFERRED_COLOR_TONE_API_VALUES[normalized] : null;
}

export function readPreferredColorTone(
  storage: Pick<Storage, "getItem"> = localStorage,
): PreferredColorToneId | null {
  try {
    return normalizePreferredColorToneId(storage.getItem("roomfit:selectedPalette"));
  } catch {
    return null;
  }
}
