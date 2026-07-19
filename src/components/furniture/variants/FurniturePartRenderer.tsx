import { useEffect, useMemo } from "react";
import { DoubleSide, FrontSide } from "three";
import { createFurniturePartGeometry } from "./geometryFactory";
import { resolveMaterialPreset } from "./materialResolver";
import type { MaterialPresetCatalog } from "./materialResolver";
import type { ValidatedFurniturePart } from "./types";
import type { PreferredColorToneId } from "../../../config/preferredColorTone";
import type { ThemeTarget } from "../../../config/furnitureBehaviorPolicy";

interface FurniturePartRendererProps {
  part: ValidatedFurniturePart;
  materialPresets: Readonly<MaterialPresetCatalog>;
  preferredColorTone?: PreferredColorToneId | null;
  themeTarget?: ThemeTarget | null;
  themeKey?: string;
}

export function FurniturePartRenderer({
  part,
  materialPresets,
  preferredColorTone,
  themeTarget,
  themeKey,
}: FurniturePartRendererProps) {
  const geometry = useMemo(() => createFurniturePartGeometry(part), [part]);
  const material = useMemo(
    () => resolveMaterialPreset(part.material, materialPresets, preferredColorTone, themeTarget, themeKey),
    [materialPresets, part.material, preferredColorTone, themeKey, themeTarget],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  const doubleSided = part.geometry === "leaf" || part.geometry === "curtain";

  return (
    <mesh
      geometry={geometry}
      position={part.position}
      rotation={part.rotation}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial {...material} side={doubleSided ? DoubleSide : FrontSide} />
    </mesh>
  );
}
