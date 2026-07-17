import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Vector3 } from "three";
import { FurnitureVariantRenderer } from "./FurnitureVariantRenderer";
import type { FurnitureVariantRegistry } from "./FurnitureVariantRegistry";
import type { MaterialPresetCatalog } from "./materialResolver";

interface FurnitureVariantPreviewProps {
  variantId: string;
  registry: FurnitureVariantRegistry;
  materialPresets: Readonly<MaterialPresetCatalog>;
}

export function FurnitureVariantPreview({
  variantId,
  registry,
  materialPresets,
}: FurnitureVariantPreviewProps) {
  return (
    <div style={{ width: "100%", minHeight: 320, aspectRatio: "16 / 10" }}>
      <Canvas shadows camera={{ position: [2.4, 1.8, 2.4], fov: 45 }}>
        <color attach="background" args={["#f4f4f2"]} />
        <ambientLight intensity={0.7} />
        <directionalLight castShadow position={[2, 4, 3]} intensity={1.2} />
        <gridHelper args={[4, 20, "#8d8d8d", "#d2d2d2"]} />
        <axesHelper args={[0.75]} />
        <arrowHelper
          args={[new Vector3(0, 0, 1), new Vector3(0, 0.01, 0), 0.9, "#2563eb"]}
        />
        <FurnitureVariantRenderer
          variantId={variantId}
          registry={registry}
          materialPresets={materialPresets}
        />
        <OrbitControls makeDefault target={[0, 0.45, 0]} />
      </Canvas>
    </div>
  );
}
