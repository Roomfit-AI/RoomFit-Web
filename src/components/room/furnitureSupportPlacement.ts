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
  const supporterFootprint = resolveFurnitureLocalFootprint(supporter);
  const dependentCorners = calculateRotatedFootprint(
    dependent.dimensions,
    dependent.rotationY,
    resolveFurnitureLocalFootprint(dependent),
  ).corners;
  const cosine = Math.cos(supporter.rotationY);
  const sine = Math.sin(supporter.rotationY);
  return dependentCorners.every((corner) => {
    const worldX = dependent.position.x + corner.x - supporter.position.x;
    const worldZ = dependent.position.z + corner.z - supporter.position.z;
    const localX = worldX * cosine + worldZ * sine;
    const localZ = -worldX * sine + worldZ * cosine;
    return localX >= supporterFootprint.minX - CENTER_EPSILON_METERS
      && localX <= supporterFootprint.maxX + CENTER_EPSILON_METERS
      && localZ >= supporterFootprint.minZ - CENTER_EPSILON_METERS
      && localZ <= supporterFootprint.maxZ + CENTER_EPSILON_METERS;
  });
}
