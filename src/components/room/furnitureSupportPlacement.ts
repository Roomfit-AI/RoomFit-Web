import { normalizeCanonicalFurnitureType } from "../../config/canonicalFurnitureType";
import type { Furniture } from "../../types";
import type { Vector3Tuple } from "../furniture/variants/types";
import {
  BOUNDARY_EPSILON,
  calculateRotatedFootprint,
  resolveFurnitureLocalFootprint,
} from "./furnitureBoundary";

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
    const supporter = visibleItems
      .filter((candidate) => (
        candidate.id !== dependent.id
        && normalizeCanonicalFurnitureType(candidate.sourceType) === supporterType
        && containsDependentCenter(candidate, dependent)
      ))
      .sort((first, second) => centerDistanceSquared(first, dependent)
        - centerDistanceSquared(second, dependent))[0];
    if (!supporter) continue;

    positions.set(dependent.id, [
      dependent.position.x,
      supporter.dimensions.height + dependent.dimensions.height / 2,
      dependent.position.z,
    ]);
  }

  return positions;
}

function containsDependentCenter(supporter: Furniture, dependent: Furniture): boolean {
  const footprint = calculateRotatedFootprint(
    supporter.dimensions,
    supporter.rotationY,
    resolveFurnitureLocalFootprint(supporter),
  );
  const localX = dependent.position.x - supporter.position.x;
  const localZ = dependent.position.z - supporter.position.z;
  return localX >= footprint.minX - BOUNDARY_EPSILON
    && localX <= footprint.maxX + BOUNDARY_EPSILON
    && localZ >= footprint.minZ - BOUNDARY_EPSILON
    && localZ <= footprint.maxZ + BOUNDARY_EPSILON;
}

function centerDistanceSquared(first: Furniture, second: Furniture): number {
  const x = first.position.x - second.position.x;
  const z = first.position.z - second.position.z;
  return x * x + z * z;
}
