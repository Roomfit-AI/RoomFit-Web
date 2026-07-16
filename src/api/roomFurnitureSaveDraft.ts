import { requireStorageWrite, safeStorageGet, safeStorageRemove, safeStorageSet } from "./safeStorage";
import type { Furniture, FurnitureStatus, RoomLayout } from "../types";

export const ROOM_FURNITURE_DRAFT_KEY = "roomfit:activeRoomFurnitureSaveDraft:v1";

export interface PersistedRoomFurnitureSaveDraft {
  version: 1;
  ownerBackendRoomId: number;
  ownerUiRoomLayoutId: string;
  revision: number;
  dirty: true;
  updatedAt: string;
  snapshot: RoomLayout;
}

export type RoomFurnitureSaveDraftReadResult =
  | { status: "none" }
  | { status: "valid"; draft: PersistedRoomFurnitureSaveDraft }
  | { status: "discarded-invalid" }
  | { status: "storage-error"; error: Error };

export interface RoomFurnitureSaveDraftStore {
  read(): RoomFurnitureSaveDraftReadResult;
  save(draft: PersistedRoomFurnitureSaveDraft): void;
  remove(expectedRevision?: number): void;
}

const FURNITURE_STATUSES: ReadonlySet<FurnitureStatus> = new Set([
  "existing",
  "deleted",
  "recommended",
  "user_modified",
]);

export class BrowserRoomFurnitureSaveDraftStore implements RoomFurnitureSaveDraftStore {
  read(): RoomFurnitureSaveDraftReadResult {
    const result = safeStorageGet("local", ROOM_FURNITURE_DRAFT_KEY);
    if (result.status === "missing") {
      return { status: "none" };
    }
    if (result.status === "storage-error") {
      return result;
    }

    const draft = parsePersistedRoomFurnitureSaveDraft(result.value);
    if (draft) {
      return { status: "valid", draft };
    }

    const removal = safeStorageRemove("local", ROOM_FURNITURE_DRAFT_KEY);
    if (removal.status === "storage-error") {
      console.warn("잘못된 Room 저장 draft를 제거하지 못했습니다.", removal.error);
    }
    return { status: "discarded-invalid" };
  }

  save(draft: PersistedRoomFurnitureSaveDraft): void {
    requireStorageWrite(
      safeStorageSet("local", ROOM_FURNITURE_DRAFT_KEY, JSON.stringify(draft)),
      "Room furniture draft storage is unavailable",
    );
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
      safeStorageRemove("local", ROOM_FURNITURE_DRAFT_KEY),
      "Room furniture draft could not be removed",
    );
  }
}

export function parsePersistedRoomFurnitureSaveDraft(raw: string | null): PersistedRoomFurnitureSaveDraft | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedRoomFurnitureSaveDraft>;
    if (
      parsed.version !== 1
      || !isPositiveInteger(parsed.ownerBackendRoomId)
      || typeof parsed.ownerUiRoomLayoutId !== "string"
      || !parsed.ownerUiRoomLayoutId.trim()
      || !isPositiveInteger(parsed.revision)
      || parsed.dirty !== true
      || !isIsoTimestamp(parsed.updatedAt)
      || !isValidRoomFurnitureSnapshot(parsed.snapshot)
      || parsed.snapshot.id !== parsed.ownerUiRoomLayoutId
    ) {
      return null;
    }
    return parsed as PersistedRoomFurnitureSaveDraft;
  } catch {
    return null;
  }
}

export function assertValidRoomFurnitureSnapshot(snapshot: RoomLayout): void {
  if (!isValidRoomFurnitureSnapshot(snapshot)) {
    throw new Error("Invalid Room furniture snapshot");
  }
}

export function isValidRoomFurnitureSnapshot(value: unknown): value is RoomLayout {
  if (!isRecord(value)) {
    return false;
  }
  if (
    typeof value.id !== "string"
    || !value.id.trim()
    || typeof value.name !== "string"
    || !isPositiveFinite(value.width)
    || !isPositiveFinite(value.depth)
    || (value.height !== undefined && !isPositiveFinite(value.height))
    || !Array.isArray(value.furniture)
    || !Array.isArray(value.walls)
    || !Array.isArray(value.doors)
    || !Array.isArray(value.windows)
  ) {
    return false;
  }

  const ids = new Set<string>();
  return value.furniture.every((item) => {
    if (!isValidFurniture(item) || ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
    return true;
  });
}

export function cloneRoomFurnitureSnapshot(snapshot: RoomLayout): RoomLayout {
  return {
    ...snapshot,
    walls: snapshot.walls.map((wall) => ({ ...wall, start: { ...wall.start }, end: { ...wall.end } })),
    doors: snapshot.doors.map((door) => ({ ...door, position: { ...door.position } })),
    windows: snapshot.windows.map((windowItem) => ({ ...windowItem, position: { ...windowItem.position } })),
    furniture: snapshot.furniture.map((item) => ({
      ...item,
      dimensions: { ...item.dimensions },
      position: { ...item.position },
      material: typeof item.material === "string" ? item.material : { ...item.material },
    })),
  };
}

function isValidFurniture(value: unknown): value is Furniture {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || !value.id.trim()
    || typeof value.name !== "string"
    || typeof value.category !== "string"
  ) {
    return false;
  }
  return isRecord(value.position)
    && isFiniteNumber(value.position.x)
    && isFiniteNumber(value.position.z)
    && isFiniteNumber(value.rotationY)
    && FURNITURE_STATUSES.has(value.status as FurnitureStatus)
    && isRecord(value.dimensions)
    && isPositiveFinite(value.dimensions.width)
    && isPositiveFinite(value.dimensions.depth)
    && isPositiveFinite(value.dimensions.height);
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
