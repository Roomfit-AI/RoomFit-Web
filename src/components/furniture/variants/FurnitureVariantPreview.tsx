import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Vector3 } from "three";
import { FurnitureVariantRenderer } from "./FurnitureVariantRenderer";
import type { FurnitureVariantRegistry } from "./FurnitureVariantRegistry";
import type { MaterialPresetCatalog } from "./materialResolver";

interface FurnitureVariantPreviewProps {
  variantId: string;
  registry: FurnitureVariantRegistry;
  materialPresets: Readonly<MaterialPresetCatalog>;
  view?: FurnitureVariantPreviewView;
}

export type FurnitureVariantPreviewView = "front" | "side" | "top";

const FRONT_DIRECTION = new Vector3(0, 0, 1);
const FLOOR_ORIGIN = new Vector3(0, 0.01, 0);

export function FurnitureVariantPreview({
  variantId,
  registry,
  materialPresets,
  view = "front",
}: FurnitureVariantPreviewProps) {
  const variant = registry.getFurnitureVariant(variantId);
  const target = useMemo<[number, number, number]>(
    () => [0, variant.dimensions.height / 2, 0],
    [variant.dimensions.height],
  );
  const cameraDistance = Math.max(
    variant.dimensions.width,
    variant.dimensions.depth,
    variant.dimensions.height,
    1,
  ) * 2.2;

  return (
    <div style={{ width: "100%", minHeight: 320, aspectRatio: "16 / 10" }}>
      <Canvas shadows camera={{ position: [2.4, 1.8, 2.4], fov: 45 }}>
        <PreviewCamera view={view} target={target} distance={cameraDistance} />
        <color attach="background" args={["#f4f4f2"]} />
        <ambientLight intensity={0.7} />
        <directionalLight castShadow position={[2, 4, 3]} intensity={1.2} />
        <gridHelper args={[4, 20, "#8d8d8d", "#d2d2d2"]} />
        <axesHelper args={[0.75]} />
        <arrowHelper
          args={[FRONT_DIRECTION, FLOOR_ORIGIN, 0.9, "#2563eb"]}
        />
        <FurnitureVariantRenderer
          variantId={variantId}
          registry={registry}
          materialPresets={materialPresets}
        />
        <OrbitControls makeDefault target={target} />
      </Canvas>
    </div>
  );
}

interface PreviewCameraProps {
  view: FurnitureVariantPreviewView;
  target: [number, number, number];
  distance: number;
}

function PreviewCamera({ view, target, distance }: PreviewCameraProps) {
  const { camera, controls } = useThree();

  useEffect(() => {
    if (view === "front") {
      camera.up.set(0, 1, 0);
      camera.position.set(0, target[1], distance);
    } else if (view === "side") {
      camera.up.set(0, 1, 0);
      camera.position.set(distance, target[1], 0);
    } else {
      camera.up.set(0, 0, -1);
      camera.position.set(0, target[1] + distance, 0);
    }
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
    if (isPreviewOrbitControls(controls)) {
      controls.target.set(...target);
      controls.update();
    }
  }, [camera, controls, distance, target, view]);

  return null;
}

interface PreviewOrbitControls {
  target: Vector3;
  update: () => void;
}

function isPreviewOrbitControls(value: unknown): value is PreviewOrbitControls {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<PreviewOrbitControls>;
  return candidate.target instanceof Vector3 && typeof candidate.update === "function";
}
