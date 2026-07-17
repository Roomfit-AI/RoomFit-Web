import { useEffect, useMemo } from "react";
import { createFurniturePartGeometry } from "./geometryFactory";
import { resolveMaterialPreset } from "./materialResolver";
import type { MaterialPresetCatalog } from "./materialResolver";
import type { ValidatedFurniturePart } from "./types";
import type { PreferredColorToneId } from "../../../config/preferredColorTone";

interface FurniturePartRendererProps {
  part: ValidatedFurniturePart;
  materialPresets: Readonly<MaterialPresetCatalog>;
  preferredColorTone?: PreferredColorToneId | null;
}

export function FurniturePartRenderer({
  part,
  materialPresets,
  preferredColorTone,
}: FurniturePartRendererProps) {
  const geometry = useMemo(() => createFurniturePartGeometry(part), [part]);
  const material = useMemo(
    () => resolveMaterialPreset(part.material, materialPresets, preferredColorTone),
    [materialPresets, part.material, preferredColorTone],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={part.position}
      rotation={part.rotation}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial {...material} />
    </mesh>
  );
}
