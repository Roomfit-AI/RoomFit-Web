import type { FurnitureMaterialType, MaterialConfig } from "../../types";

type ResolvedMaterialConfig = {
  type: FurnitureMaterialType;
  color: string;
  roughness: number;
  metalness: number;
};

const materialDefaults: Record<FurnitureMaterialType, Omit<ResolvedMaterialConfig, "type">> = {
  fabric: { roughness: 0.9, metalness: 0, color: "#f4eee5" },
  wood: { roughness: 0.55, metalness: 0, color: "#8a623d" },
  white: { roughness: 0.78, metalness: 0, color: "#f7f4ef" },
  metal: { roughness: 0.25, metalness: 0.8, color: "#24211e" },
  glass: { roughness: 0.08, metalness: 0.12, color: "#101010" },
  accent: { roughness: 0.72, metalness: 0, color: "#6f7d54" },
};

export function materialFromConfig(
  material: FurnitureMaterialType | MaterialConfig,
  fallbackColor?: string,
): ResolvedMaterialConfig {
  if (typeof material === "string") {
    const defaults = materialDefaults[material];
    return {
      type: material,
      color: fallbackColor ?? defaults.color,
      roughness: defaults.roughness,
      metalness: defaults.metalness,
    };
  }

  const defaults = materialDefaults[material.type];
  return {
    type: material.type,
    color: material.color ?? fallbackColor ?? defaults.color,
    roughness: material.roughness ?? defaults.roughness,
    metalness: material.metalness ?? defaults.metalness,
  };
}
