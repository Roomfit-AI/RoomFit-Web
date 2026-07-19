import type { RoomLayout } from "../types";
import { resolveRequiredFurnitureTypes } from "../api/agentContextRequest";

export const MAX_NEW_ADDITIONS = 8;
export const MAX_ACTIVE_FURNITURE = 12;

export interface FurnitureAdditionLimitResult {
  activeFurnitureCount: number;
  newAdditionCount: number;
  finalActiveFurnitureCount: number;
  allowed: boolean;
}

export class FurnitureAdditionLimitError extends Error {
  readonly result: FurnitureAdditionLimitResult;

  constructor(result: FurnitureAdditionLimitResult) {
    super("The selected furniture exceeds the addition limit.");
    this.name = "FurnitureAdditionLimitError";
    this.result = result;
  }
}

export function evaluateFurnitureAdditionLimit(
  room: RoomLayout | null,
  selectedIds: readonly string[],
): FurnitureAdditionLimitResult {
  const activeFurnitureCount = room?.furniture.filter((item) => item.status !== "deleted").length ?? 0;
  const newAdditionCount = resolveRequiredFurnitureTypes(selectedIds).length;
  const finalActiveFurnitureCount = activeFurnitureCount + newAdditionCount;
  return {
    activeFurnitureCount,
    newAdditionCount,
    finalActiveFurnitureCount,
    allowed: newAdditionCount <= MAX_NEW_ADDITIONS
      && finalActiveFurnitureCount <= MAX_ACTIVE_FURNITURE,
  };
}

export function assertFurnitureAdditionAllowed(
  room: RoomLayout | null,
  selectedIds: readonly string[],
): FurnitureAdditionLimitResult {
  const result = evaluateFurnitureAdditionLimit(room, selectedIds);
  if (!result.allowed) {
    throw new FurnitureAdditionLimitError(result);
  }
  return result;
}

export function isFurnitureAdditionLimitError(error: unknown): error is FurnitureAdditionLimitError {
  return error instanceof FurnitureAdditionLimitError;
}
