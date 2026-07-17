import { useEffect, useMemo } from "react";
import { createFurniturePartGeometry } from "./geometryFactory";
import { resolveMaterialPreset } from "./materialResolver";
import type { MaterialPresetCatalog } from "./materialResolver";
import type { ValidatedFurniturePart } from "./types";

interface FurniturePartRendererProps {
  part: ValidatedFurniturePart;
  materialPresets: Readonly<MaterialPresetCatalog>;
}

export function FurniturePartRenderer({
  part,
  materialPresets,
}: FurniturePartRendererProps) {
  const geometry = useMemo(() => createFurniturePartGeometry(part), [part]);
  const material = useMemo(
    () => resolveMaterialPreset(part.material, materialPresets),
    [materialPresets, part.material],
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
