import { normalizeCanonicalFurnitureType } from "../../config/canonicalFurnitureType";
import type { Furniture } from "../../types";
import type { Vector3Tuple } from "../furniture/variants/types";

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
