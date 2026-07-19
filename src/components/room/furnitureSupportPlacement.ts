import { normalizeCanonicalFurnitureType } from "../../config/canonicalFurnitureType";
import type { Furniture } from "../../types";
import type { Vector3Tuple } from "../furniture/variants/types";
import {
  calculateRotatedFootprint,
  resolveFurnitureLocalFootprint,
} from "./furnitureBoundary";

const CENTER_EPSILON_METERS = 1e-6;

const SUPPORT_TYPE_BY_DEPENDENT = {
  monitor: "desk",
  tv: "media_console",
} as const;

export function resolveFurnitureSupportPositions(
  items: readonly Furniture[],
): Map<string, Vector3Tuple> {
  const visibleItems = items.filter((item) => item.status !== "deleted");
  const positions = new Map<string, Vector3Tuple>(visibleItems.map((item) => [
    item.id,
    [item.position.x, item.dimensions.height / 2, item.position.z],
  ]));

  for (const dependent of visibleItems) {
    const dependentType = normalizeCanonicalFurnitureType(dependent.sourceType);
    if (dependentType !== "monitor" && dependentType !== "tv") continue;
    const supporterType = SUPPORT_TYPE_BY_DEPENDENT[dependentType];
    const supporter = visibleItems.find((candidate) => (
      candidate.id !== dependent.id
      && normalizeCanonicalFurnitureType(candidate.sourceType) === supporterType
      && hasMatchingCenter(candidate, dependent)
      && containsFootprint(candidate, dependent)
    ));
    if (!supporter) continue;

    positions.set(dependent.id, [
      dependent.position.x,
      supporter.dimensions.height + dependent.dimensions.height / 2,
      dependent.position.z,
    ]);
  }

  return positions;
}

function hasMatchingCenter(supporter: Furniture, dependent: Furniture): boolean {
  return Math.abs(supporter.position.x - dependent.position.x) <= CENTER_EPSILON_METERS
    && Math.abs(supporter.position.z - dependent.position.z) <= CENTER_EPSILON_METERS;
}

function containsFootprint(supporter: Furniture, dependent: Furniture): boolean {
  const supporterBounds = worldFootprintBounds(supporter);
  const dependentBounds = worldFootprintBounds(dependent);
  return dependentBounds.minX >= supporterBounds.minX - CENTER_EPSILON_METERS
    && dependentBounds.maxX <= supporterBounds.maxX + CENTER_EPSILON_METERS
    && dependentBounds.minZ >= supporterBounds.minZ - CENTER_EPSILON_METERS
    && dependentBounds.maxZ <= supporterBounds.maxZ + CENTER_EPSILON_METERS;
}

function worldFootprintBounds(item: Furniture) {
  const footprint = calculateRotatedFootprint(
    item.dimensions,
    item.rotationY,
    resolveFurnitureLocalFootprint(item),
  );
  return {
    minX: item.position.x + footprint.minX,
    maxX: item.position.x + footprint.maxX,
    minZ: item.position.z + footprint.minZ,
    maxZ: item.position.z + footprint.maxZ,
  };
}
