import Material, { materialFromConfig } from "../materials/Material";
import Bookshelf from "./Bookshelf";
import Lamp from "./Lamp";
import ModelFurniture from "./ModelFurniture";
import Plant from "./Plant";
import Sofa from "./Sofa";
import Table from "./Table";
import type { Furniture } from "../../types";

export default function FurnitureRenderer({ item }: { item: Furniture }) {
  const name = `${item.id} ${item.name}`.toLowerCase();
  const material = materialFromConfig(item.material, item.color);

  if (item.geometry === "model" && item.model) {
    return <ModelFurniture item={item} />;
  }

  if (name.includes("plant") || item.name.includes("화병")) {
    return <Plant item={item} />;
  }

  if (item.category === "lighting") {
    return <Lamp item={item} />;
  }

  if (item.category === "rug" || item.geometry === "plane") {
    return (
      <mesh receiveShadow position={[0, -item.dimensions.height / 2 + 0.018, 0]}>
        <boxGeometry args={[item.dimensions.width, item.dimensions.height, item.dimensions.depth]} />
        <Material {...material} roughness={material.roughness ?? 0.96} />
      </mesh>
    );
  }

  if (item.category === "desk") {
    return <Table item={item} />;
  }

  if (item.category === "chair") {
    return <Sofa item={item} />;
  }

  if (name.includes("tv") && !name.includes("stand")) {
    return <Television item={item} />;
  }

  if (item.name.includes("책장") || name.includes("shelf")) {
    return <Bookshelf item={item} />;
  }

  if (item.geometry === "cylinder") {
    return (
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[item.dimensions.width / 2, item.dimensions.width / 2, item.dimensions.height, 48]} />
        <Material {...material} />
      </mesh>
    );
  }

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[item.dimensions.width, item.dimensions.height, item.dimensions.depth]} />
      <Material {...material} />
    </mesh>
  );
}

function Television({ item }: { item: Furniture }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[item.dimensions.width, item.dimensions.height, item.dimensions.depth]} />
        <Material type="glass" color="#0d0d0d" roughness={0.24} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0, item.dimensions.depth / 2 + 0.006]}>
        <boxGeometry args={[item.dimensions.width * 0.88, item.dimensions.height * 0.78, 0.01]} />
        <Material type="glass" color="#161616" roughness={0.08} metalness={0.28} />
      </mesh>
    </group>
  );
}
