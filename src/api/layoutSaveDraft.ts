import type { Furniture, FurnitureStatus, RoomLayout } from "../types";
import {
  requireStorageWrite,
  safeStorageGet,
  safeStorageKeys,
  safeStorageRemove,
  safeStorageSet,
} from "./safeStorage";

export interface PersistedLayoutSaveDraft {
  version: 2;
  layoutId: number;
  ownerBackendRoomId: number;
  ownerUiRoomLayoutId: string;
  revision: number;
  dirty: true;
  updatedAt: string;
  roomLayout: RoomLayout;
}

export interface LayoutSaveDraftStore {
  read(): LayoutSaveDraftReadResult;
  save(draft: PersistedLayoutSaveDraft): void;
  remove(expectedRevision?: number): void;
}

export type LayoutSaveDraftReadResult =
  | { status: "none" }
  | { status: "valid"; draft: PersistedLayoutSaveDraft }
  | { status: "discarded-invalid" }
  | { status: "storage-error"; error: Error };

const ACTIVE_DRAFT_KEY = "roomfit:activeLayoutSaveDraft:v2";
const LEGACY_DRAFT_KEY_PREFIX = "roomfit:layoutSaveDraft:v1:";
const FURNITURE_STATUSES: ReadonlySet<FurnitureStatus> = new Set([
  "existing",
  "deleted",
  "recommended",
  "user_modified",
]);

export class BrowserLayoutSaveDraftStore implements LayoutSaveDraftStore {
  read(): LayoutSaveDraftReadResult {
    const result = safeStorageGet("local", ACTIVE_DRAFT_KEY);
    if (result.status === "missing") {
      return { status: "none" };
    }
    if (result.status === "storage-error") {
      return result;
    }

    const draft = parsePersistedLayoutSaveDraft(result.value);
    if (draft) {
      return { status: "valid", draft };
    }
    const removal = safeStorageRemove("local", ACTIVE_DRAFT_KEY);
    if (removal.status === "storage-error") {
      console.warn("잘못된 미저장 배치 정보를 제거하지 못했습니다.", removal.error);
    }
    return { status: "discarded-invalid" };
  }

  save(draft: PersistedLayoutSaveDraft): void {
    requireStorageWrite(
      safeStorageSet("local", ACTIVE_DRAFT_KEY, JSON.stringify(draft)),
      "Layout draft storage is unavailable",
    );
    try {
      removeLegacyDrafts();
    } catch (error) {
      console.warn("현재 배치 draft는 저장했지만 이전 형식의 draft를 정리하지 못했습니다.", error);
    }
  }

  remove(expectedRevision?: number): void {
    if (expectedRevision !== undefined) {
      const current = this.read();
      if (current.status === "storage-error") {
        throw current.error;
      }
      if (current.status === "valid" && current.draft.revision !== expectedRevision) {
        return;
      }
    }
    requireStorageWrite(
      safeStorageRemove("local", ACTIVE_DRAFT_KEY),
      "Layout draft could not be removed",
    );
    try {
      removeLegacyDrafts();
    } catch (error) {
      console.warn("현재 배치 draft는 제거했지만 이전 형식의 draft를 정리하지 못했습니다.", error);
    }
  }
}

export function parsePersistedLayoutSaveDraft(raw: string | null): PersistedLayoutSaveDraft | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedLayoutSaveDraft>;
    if (
      parsed.version !== 2
      || !isPositiveInteger(parsed.layoutId)
      || !isPositiveInteger(parsed.ownerBackendRoomId)
      || typeof parsed.ownerUiRoomLayoutId !== "string"
      || !parsed.ownerUiRoomLayoutId.trim()
      || !isPositiveInteger(parsed.revision)
      || parsed.dirty !== true
      || !isIsoTimestamp(parsed.updatedAt)
      || !isValidRoomLayout(parsed.roomLayout)
      || parsed.roomLayout.id !== parsed.ownerUiRoomLayoutId
    ) {
      return null;
    }
    return parsed as PersistedLayoutSaveDraft;
  } catch {
    return null;
  }
}

export function assertValidRoomLayout(layout: RoomLayout): void {
  if (!isValidRoomLayout(layout)) {
    throw new Error("Invalid room layout snapshot");
  }
}

export function cloneRoomLayout(layout: RoomLayout): RoomLayout {
  return {
    ...layout,
    furniture: layout.furniture.map((item) => ({
      ...item,
      dimensions: { ...item.dimensions },
      position: { ...item.position },
      material: typeof item.material === "string" ? item.material : { ...item.material },
    })),
  };
}

function isValidRoomLayout(value: unknown): value is RoomLayout {
  if (!isRecord(value)) {
    return false;
  }
  if (
    typeof value.id !== "string"
    || !value.id.trim()
    || typeof value.name !== "string"
    || !isPositiveFinite(value.width)
    || !isPositiveFinite(value.depth)
    || !Array.isArray(value.furniture)
    || value.furniture.length === 0
    || !Array.isArray(value.walls)
    || !Array.isArray(value.doors)
    || !Array.isArray(value.windows)
  ) {
    return false;
  }

  const furnitureIds = new Set<string>();
  return value.furniture.every((item) => {
    if (!isValidFurniture(item) || furnitureIds.has(item.id)) {
      return false;
    }
    furnitureIds.add(item.id);
    return true;
  });
}

function isValidFurniture(value: unknown): value is Furniture {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
    return false;
  }
  if (!isRecord(value.position) || !isFiniteNumber(value.position.x) || !isFiniteNumber(value.position.z)) {
    return false;
  }
  if (!isFiniteNumber(value.rotationY) || !FURNITURE_STATUSES.has(value.status as FurnitureStatus)) {
    return false;
  }
  return isRecord(value.dimensions)
    && isPositiveFinite(value.dimensions.width)
    && isPositiveFinite(value.dimensions.depth)
    && isPositiveFinite(value.dimensions.height);
}

function removeLegacyDrafts(): void {
  const result = safeStorageKeys("local");
  if (result.status === "storage-error") {
    throw result.error;
  }
  result.keys.filter((key) => key.startsWith(LEGACY_DRAFT_KEY_PREFIX)).forEach((key) => {
    requireStorageWrite(
      safeStorageRemove("local", key),
      "Legacy Layout draft could not be removed",
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
