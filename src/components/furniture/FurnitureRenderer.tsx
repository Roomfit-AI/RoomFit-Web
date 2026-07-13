import Material, { materialFromConfig } from "../materials/Material";
import Bed from "./Bed";
import Bookshelf from "./Bookshelf";
import Chair from "./Chair";
import Lamp from "./Lamp";
import ModelFurniture from "./ModelFurniture";
import Plant from "./Plant";
import Sofa from "./Sofa";
import Storage from "./Storage";
import Table from "./Table";
import Television from "./Television";
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

  if (item.category === "bed") {
    return <Bed item={item} />;
  }

  if (item.category === "desk") {
    return <Table item={item} />;
  }

  if (item.category === "chair") {
    // "chair" covers both real chairs and sofas (rooms.ts collapses both
    // furniture types into this one category) — only render the wide
    // cushioned Sofa for items actually labeled as one, a single-seat Chair
    // otherwise, so a desk chair doesn't get mistaken for a couch.
    if (name.includes("소파") || name.includes("sofa") || name.includes("couch")) {
      return <Sofa item={item} />;
    }
    return <Chair item={item} />;
  }

  if (name.includes("tv") && !name.includes("stand")) {
    return <Television item={item} />;
  }

  if (item.name.includes("책장") || name.includes("shelf")) {
    return <Bookshelf item={item} />;
  }

  if (item.category === "cabinet") {
    return <Storage item={item} />;
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
