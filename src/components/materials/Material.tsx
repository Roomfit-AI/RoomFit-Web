import type { FurnitureMaterialType } from "../../types";
import { materialFromConfig } from "./materialConfig";

interface MaterialProps {
  type?: FurnitureMaterialType;
  color?: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  transparent?: boolean;
}

export default function Material({
  type = "fabric",
  color,
  roughness,
  metalness,
  opacity,
  transparent,
}: MaterialProps) {
  const defaults = materialFromConfig(type, color);

  return (
    <meshStandardMaterial
      color={defaults.color}
      roughness={roughness ?? defaults.roughness}
      metalness={metalness ?? defaults.metalness}
      opacity={opacity}
      transparent={transparent ?? opacity !== undefined}
    />
  );
}
