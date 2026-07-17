import { FurniturePartRenderer } from "./FurniturePartRenderer";
import type { FurnitureVariantRegistry } from "./FurnitureVariantRegistry";
import type { MaterialPresetCatalog } from "./materialResolver";
import type { Vector3Tuple } from "./types";
import type { PreferredColorToneId } from "../../../config/preferredColorTone";

interface FurnitureVariantRendererProps {
  variantId: string;
  registry: FurnitureVariantRegistry;
  materialPresets: Readonly<MaterialPresetCatalog>;
  layoutPosition?: Vector3Tuple;
  layoutRotation?: Vector3Tuple;
  preferredColorTone?: PreferredColorToneId | null;
}

const IDENTITY_POSITION: Vector3Tuple = [0, 0, 0];
const IDENTITY_ROTATION: Vector3Tuple = [0, 0, 0];

export function FurnitureVariantRenderer({
  variantId,
  registry,
  materialPresets,
  layoutPosition = IDENTITY_POSITION,
  layoutRotation = IDENTITY_ROTATION,
  preferredColorTone,
}: FurnitureVariantRendererProps) {
  const variant = registry.getFurnitureVariant(variantId);

  return (
    <group position={layoutPosition} rotation={layoutRotation} scale={[1, 1, 1]}>
      {variant.parts.map((part) => (
        <FurniturePartRenderer
          key={part.id}
          part={part}
          materialPresets={materialPresets}
          preferredColorTone={preferredColorTone}
        />
      ))}
    </group>
  );
}
