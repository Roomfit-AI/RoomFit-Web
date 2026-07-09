import { useGLTF } from "@react-three/drei";
import type { Furniture } from "../../types";

export default function ModelFurniture({ item }: { item: Furniture }) {
  const model = useGLTF(item.model ?? "");

  return (
    <primitive
      object={model.scene}
      scale={[item.dimensions.width, item.dimensions.height, item.dimensions.depth]}
    />
  );
}
