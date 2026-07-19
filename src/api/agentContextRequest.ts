import {
  toPreferredColorToneApiValue,
  type PreferredColorToneApiValue,
} from "../config/preferredColorTone";
import type { CanonicalFurnitureType } from "../config/canonicalFurnitureType";
import { FURNITURE_TYPE_BY_UI_ID } from "../config/furnitureSelectionCatalog";
import { hasDeskLoftConflict, DESK_LOFT_CONFLICT_MESSAGE } from "../config/furnitureSelectionPolicy";

export type LifestyleGoalApiValue =
  | "STUDY_FOCUSED"
  | "RELAX_FOCUSED"
  | "STORAGE_FOCUSED"
  | "WFH_FOCUSED";

export type DesignStyleApiValue =
  | "MINIMAL"
  | "NATURAL"
  | "WHITE_TONE"
  | "WOOD_TONE"
  | "COZY"
  | "MODERN"
  | "CLASSIC"
  | "MIDCENTURY";

export type FurnitureTypeApiValue = CanonicalFurnitureType;

export interface AgentContextRequest {
  roomId: number;
  lifestyleGoal: LifestyleGoalApiValue;
  designStyle: DesignStyleApiValue[];
  requiredItems: FurnitureTypeApiValue[];
  optionalItems: FurnitureTypeApiValue[];
  selectedImageIds: number[];
  selectedProductIds: string[];
  preferredColorTone: PreferredColorToneApiValue | null;
}

export interface AgentContextRequestInput {
  roomId: unknown;
  purpose: unknown;
  style: unknown;
  palette: unknown;
  additionalFurnitureIds: unknown;
  selectedImageIds?: unknown;
}

const lifestyleGoalByPurpose: Readonly<Record<string, LifestyleGoalApiValue>> = {
  rest: "RELAX_FOCUSED",
  work: "STUDY_FOCUSED",
  hobby: "RELAX_FOCUSED",
  storage: "STORAGE_FOCUSED",
};

const designStyleByUiId: Readonly<Record<string, DesignStyleApiValue>> = {
  minimal: "MINIMAL",
  natural: "NATURAL",
  modern: "MODERN",
  classic: "CLASSIC",
  midcentury: "MIDCENTURY",
};

// Stable Backend style-image IDs are explicit and never derived from the UI
// option's array index.
const styleImageIdByUiId: Readonly<Record<string, number>> = {
  minimal: 1,
  natural: 2,
  modern: 3,
  classic: 4,
  midcentury: 5,
};

export class AgentContextRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentContextRequestValidationError";
  }
}

export function resolveLifestyleGoal(value: unknown): LifestyleGoalApiValue | null {
  return typeof value === "string" ? lifestyleGoalByPurpose[value] ?? null : null;
}

export function resolveDesignStyle(value: unknown): DesignStyleApiValue | null {
  return typeof value === "string" ? designStyleByUiId[value] ?? null : null;
}

export function resolveStyleImageIds(value: unknown): number[] {
  if (typeof value !== "string") {
    return [];
  }

  const imageId = styleImageIdByUiId[value];
  return imageId === undefined ? [] : [imageId];
}

export function resolveRequiredFurnitureTypes(value: unknown): FurnitureTypeApiValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const resolved = new Set<FurnitureTypeApiValue>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const furnitureType = FURNITURE_TYPE_BY_UI_ID[item];
    if (furnitureType) {
      resolved.add(furnitureType);
    }
  }
  return Array.from(resolved);
}

export function normalizeBackendRoomId(value: unknown): number | null {
  const parsed = typeof value === "string" && /^[1-9]\d*$/.test(value)
    ? Number(value)
    : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

export function normalizeSelectedImageIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const imageIds = new Set<number>();
  for (const item of value) {
    const parsed = typeof item === "string" && /^[1-9]\d*$/.test(item)
      ? Number(item)
      : item;
    if (typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed > 0) {
      imageIds.add(parsed);
    }
  }
  return Array.from(imageIds);
}

export function buildAgentContextRequest(input: AgentContextRequestInput): AgentContextRequest {
  if (Array.isArray(input.additionalFurnitureIds) && hasDeskLoftConflict(input.additionalFurnitureIds)) {
    throw new AgentContextRequestValidationError(DESK_LOFT_CONFLICT_MESSAGE);
  }
  const roomId = normalizeBackendRoomId(input.roomId);
  if (roomId === null) {
    throw new AgentContextRequestValidationError("유효한 백엔드 방을 다시 선택해 주세요.");
  }

  const lifestyleGoal = resolveLifestyleGoal(input.purpose);
  if (lifestyleGoal === null) {
    throw new AgentContextRequestValidationError("라이프스타일을 선택해 주세요.");
  }

  const designStyle = resolveDesignStyle(input.style);
  if (designStyle === null) {
    throw new AgentContextRequestValidationError("인테리어 스타일을 선택해 주세요.");
  }

  const requiredItems = resolveRequiredFurnitureTypes(input.additionalFurnitureIds);
  if (requiredItems.length === 0) {
    throw new AgentContextRequestValidationError("추천에 포함할 가구를 하나 이상 선택해 주세요.");
  }

  const selectedImageIds = normalizeSelectedImageIds(
    input.selectedImageIds ?? resolveStyleImageIds(input.style),
  );
  if (selectedImageIds.length === 0) {
    throw new AgentContextRequestValidationError("추천에 사용할 스타일 이미지를 선택해 주세요.");
  }

  return {
    roomId,
    lifestyleGoal,
    designStyle: [designStyle],
    requiredItems,
    optionalItems: [],
    selectedImageIds,
    selectedProductIds: [],
    preferredColorTone: toPreferredColorToneApiValue(input.palette),
  };
}
