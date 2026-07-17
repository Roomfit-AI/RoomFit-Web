import { normalizePreferredColorToneId, type PreferredColorToneId } from "../../config/preferredColorTone";
import type { Furniture, FurnitureMaterialType } from "../../types";

type PaletteFamily = "wood" | "fabric" | "metal" | "neutral";

type PaletteColors = Record<PaletteFamily, string>;

export const FURNITURE_MATERIAL_PALETTES: Readonly<Record<PreferredColorToneId, PaletteColors>> = {
  ivory: { wood: "#D8C4A6", fabric: "#F0E8DA", metal: "#D5D2CB", neutral: "#E9E3D9" },
  beige: { wood: "#B58D66", fabric: "#D9C8AD", metal: "#A99B8C", neutral: "#D4C0A4" },
  gray: { wood: "#85817D", fabric: "#B9B9B9", metal: "#6F7479", neutral: "#A5A5A5" },
  brown: { wood: "#6B4A35", fabric: "#8A6A58", metal: "#625147", neutral: "#795A45" },
  green: { wood: "#59634A", fabric: "#6D7B61", metal: "#4D5B4E", neutral: "#607054" },
  blue: { wood: "#3F536A", fabric: "#526B86", metal: "#34495E", neutral: "#455E78" },
  pink: { wood: "#B47778", fabric: "#D39AA6", metal: "#936E75", neutral: "#C5838E" },
  black: { wood: "#292725", fabric: "#353535", metal: "#17191C", neutral: "#252525" },
};

interface ColorMaterialPreset {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
}

const PROTECTED_PRESET_IDS = new Set([
  "glass",
  "mirror",
  "screen",
  "screenframe",
  "light",
  "lampshade",
  "leddiffuser",
  "plant",
  "plantlight",
  "plantstem",
  "soil",
]);

export function applyPreferredColorToneToMaterialPreset<T extends ColorMaterialPreset>(
  presetId: string,
  preset: T,
  preferredColorTone: unknown,
): T {
  const tone = normalizePreferredColorToneId(preferredColorTone);

  if (!tone || isProtectedMaterialPreset(presetId, preset)) {
    return preset;
  }

  return {
    ...preset,
    color: FURNITURE_MATERIAL_PALETTES[tone][materialFamilyForPreset(presetId)],
  };
}

export function applyPreferredColorToneToLegacyFurniture(
  item: Furniture,
  preferredColorTone: unknown,
): Furniture {
  const tone = normalizePreferredColorToneId(preferredColorTone);

  if (!tone || isProtectedLegacyFurniture(item)) {
    return item;
  }

  const materialType = typeof item.material === "string" ? item.material : item.material.type;
  const color = FURNITURE_MATERIAL_PALETTES[tone][materialFamilyForLegacyType(materialType)];

  return {
    ...item,
    color,
    material: typeof item.material === "string"
      ? { type: item.material, color }
      : { ...item.material, color },
  };
}

export function isProtectedMaterialPreset(
  presetId: string,
  preset: ColorMaterialPreset,
): boolean {
  const normalizedId = presetId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return PROTECTED_PRESET_IDS.has(normalizedId)
    || Boolean(preset.emissive)
    || (preset.emissiveIntensity ?? 0) > 0;
}

function materialFamilyForPreset(presetId: string): PaletteFamily {
  const normalizedId = presetId.toLowerCase();

  if (normalizedId.includes("wood")) return "wood";
  if (normalizedId.includes("fabric") || normalizedId.includes("leather")) return "fabric";
  if (
    normalizedId.includes("metal")
    || normalizedId.includes("steel")
    || normalizedId.includes("brass")
  ) return "metal";
  return "neutral";
}

function materialFamilyForLegacyType(type: FurnitureMaterialType): PaletteFamily {
  if (type === "wood") return "wood";
  if (type === "fabric") return "fabric";
  if (type === "metal") return "metal";
  return "neutral";
}

function isProtectedLegacyFurniture(item: Furniture): boolean {
  const materialType = typeof item.material === "string" ? item.material : item.material.type;
  if (materialType === "glass" || item.category === "lighting" || item.geometry === "model") {
    return true;
  }

  const identity = `${item.id} ${item.name}`.toLowerCase();
  return /(^|[\s_-])(tv|screen|monitor|mirror|plant|leaf|stem|soil)([\s_-]|$)/.test(identity)
    || ["텔레비전", "모니터", "스크린", "거울", "식물", "화분", "화병", "몬스테라", "잎", "줄기", "흙"]
      .some((token) => identity.includes(token));
}
