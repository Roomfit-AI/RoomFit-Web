import { isValidRoomFurnitureSnapshot } from "./roomFurnitureSaveDraft";
import { requireStorageWrite, safeStorageGet, safeStorageRemove, safeStorageSet } from "./safeStorage";
import type { RoomLayout } from "../types";

const SELECTED_ROOM_KEY = "roomfit:selectedRoom:v1";
const STAGED_SELECTED_ROOM_KEY = "roomfit:selectedRoom:staged:v1";

export interface SelectedRoomEnvelope {
  version: 1;
  backendRoomId: number;
  uiRoomLayoutId: string;
  title: string;
  category: string;
  size: string;
  roomLayout: RoomLayout;
}

export type SelectedRoomReadResult =
  | { status: "valid"; selection: SelectedRoomEnvelope }
  | { status: "none" }
  | { status: "invalid" }
  | { status: "storage-error"; error: Error };

export interface SelectedRoomCommitResult {
  warnings: Error[];
}

export function readSelectedRoomEnvelope(): SelectedRoomReadResult {
  const current = safeStorageGet("local", SELECTED_ROOM_KEY);
  if (current.status === "storage-error") {
    return current;
  }
  if (current.status === "success") {
    const selection = parseSelectedRoomEnvelope(current.value);
    return selection ? { status: "valid", selection } : { status: "invalid" };
  }
  return readLegacySelectedRoom();
}

export function stageSelectedRoomEnvelope(selection: SelectedRoomEnvelope): void {
  assertValidSelectedRoomEnvelope(selection);
  requireStorageWrite(
    safeStorageSet("local", STAGED_SELECTED_ROOM_KEY, JSON.stringify(selection)),
    "Selected Room transition could not be staged",
  );
}

export function commitStagedSelectedRoomEnvelope(selection: SelectedRoomEnvelope): SelectedRoomCommitResult {
  assertValidSelectedRoomEnvelope(selection);
  const staged = safeStorageGet("local", STAGED_SELECTED_ROOM_KEY);
  if (staged.status !== "success" || !matchesSelection(staged.value, selection)) {
    throw new Error("Selected Room transition stage is missing or invalid");
  }

  requireStorageWrite(
    safeStorageSet("local", SELECTED_ROOM_KEY, JSON.stringify(selection)),
    "Selected Room transition could not be committed",
  );

  const warnings = writeLegacyMirrors(selection);
  const stageRemoval = safeStorageRemove("local", STAGED_SELECTED_ROOM_KEY);
  if (stageRemoval.status === "storage-error") {
    warnings.push(stageRemoval.error);
  }
  return { warnings };
}

export function restoreSelectedRoomEnvelope(previous: SelectedRoomEnvelope | null): boolean {
  const result = previous
    ? safeStorageSet("local", SELECTED_ROOM_KEY, JSON.stringify(previous))
    : safeStorageRemove("local", SELECTED_ROOM_KEY);
  safeStorageRemove("local", STAGED_SELECTED_ROOM_KEY);
  if (result.status !== "success") {
    return false;
  }
  if (previous) {
    return writeLegacyMirrors(previous).length === 0;
  }
  return [
    "roomfit:backendRoomId",
    "roomfit:selectedRoomId",
    "roomfit:selectedRoomTitle",
    "roomfit:selectedRoomType",
    "roomfit:selectedRoomSize",
    "roomfit:selectedRoomLayout",
  ].map((key) => safeStorageRemove("local", key)).every((removal) => removal.status === "success");
}

export function updateSelectedRoomSnapshot(snapshot: RoomLayout): void {
  const current = readSelectedRoomEnvelope();
  if (current.status === "storage-error") {
    throw current.error;
  }
  if (current.status !== "valid" || current.selection.uiRoomLayoutId !== snapshot.id) {
    throw new Error("Selected Room mirror belongs to a different Room");
  }

  const next: SelectedRoomEnvelope = {
    ...current.selection,
    roomLayout: snapshot,
  };
  requireStorageWrite(
    safeStorageSet("local", SELECTED_ROOM_KEY, JSON.stringify(next)),
    "Selected Room snapshot could not be updated",
  );
  const mirrorWarnings = writeLegacyMirrors(next);
  if (mirrorWarnings.length > 0) {
    console.warn("Selected Room compatibility mirrors could not all be updated.", mirrorWarnings);
  }
}

export function clearSelectedRoomEnvelopeForOwner(ownerBackendRoomId: number): boolean {
  const current = readSelectedRoomEnvelope();
  if (current.status === "storage-error") {
    return false;
  }
  if (current.status !== "valid" || current.selection.backendRoomId !== ownerBackendRoomId) {
    return true;
  }

  const removals = [
    SELECTED_ROOM_KEY,
    STAGED_SELECTED_ROOM_KEY,
    "roomfit:backendRoomId",
    "roomfit:selectedRoomId",
    "roomfit:selectedRoomTitle",
    "roomfit:selectedRoomType",
    "roomfit:selectedRoomSize",
    "roomfit:selectedRoomLayout",
  ].map((key) => safeStorageRemove("local", key));
  return removals.every((result) => result.status === "success");
}

export function parseSelectedRoomEnvelope(raw: string | null): SelectedRoomEnvelope | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SelectedRoomEnvelope>;
    if (
      parsed.version !== 1
      || !isPositiveInteger(parsed.backendRoomId)
      || typeof parsed.uiRoomLayoutId !== "string"
      || !parsed.uiRoomLayoutId.trim()
      || typeof parsed.title !== "string"
      || typeof parsed.category !== "string"
      || typeof parsed.size !== "string"
      || !isValidRoomFurnitureSnapshot(parsed.roomLayout)
      || parsed.roomLayout.id !== parsed.uiRoomLayoutId
    ) {
      return null;
    }
    return parsed as SelectedRoomEnvelope;
  } catch {
    return null;
  }
}

function readLegacySelectedRoom(): SelectedRoomReadResult {
  const results = {
    backendRoomId: safeStorageGet("local", "roomfit:backendRoomId"),
    uiRoomLayoutId: safeStorageGet("local", "roomfit:selectedRoomId"),
    title: safeStorageGet("local", "roomfit:selectedRoomTitle"),
    category: safeStorageGet("local", "roomfit:selectedRoomType"),
    size: safeStorageGet("local", "roomfit:selectedRoomSize"),
    roomLayout: safeStorageGet("local", "roomfit:selectedRoomLayout"),
  };
  const storageError = Object.values(results).find((result) => result.status === "storage-error");
  if (storageError?.status === "storage-error") {
    return storageError;
  }
  if (results.backendRoomId.status === "missing" && results.uiRoomLayoutId.status === "missing") {
    return { status: "none" };
  }
  if (
    results.backendRoomId.status !== "success"
    || results.uiRoomLayoutId.status !== "success"
    || results.roomLayout.status !== "success"
  ) {
    return { status: "invalid" };
  }

  const roomLayout = parseRoomLayout(results.roomLayout.value);
  const backendRoomId = Number(results.backendRoomId.value);
  if (!roomLayout || !isPositiveInteger(backendRoomId) || roomLayout.id !== results.uiRoomLayoutId.value) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    selection: {
      version: 1,
      backendRoomId,
      uiRoomLayoutId: roomLayout.id,
      title: results.title.status === "success" ? results.title.value : roomLayout.name,
      category: results.category.status === "success" ? results.category.value : "원룸",
      size: results.size.status === "success"
        ? results.size.value
        : `${Math.round(roomLayout.width * roomLayout.depth)}㎡`,
      roomLayout,
    },
  };
}

function writeLegacyMirrors(selection: SelectedRoomEnvelope): Error[] {
  const values: Array<[string, string]> = [
    ["roomfit:backendRoomId", String(selection.backendRoomId)],
    ["roomfit:selectedRoomId", selection.uiRoomLayoutId],
    ["roomfit:selectedRoomTitle", selection.title],
    ["roomfit:selectedRoomType", selection.category],
    ["roomfit:selectedRoomSize", selection.size],
    ["roomfit:selectedRoomLayout", JSON.stringify(selection.roomLayout)],
  ];
  return values.flatMap(([key, value]) => {
    const result = safeStorageSet("local", key, value);
    return result.status === "storage-error" ? [result.error] : [];
  });
}

function matchesSelection(raw: string, expected: SelectedRoomEnvelope): boolean {
  const parsed = parseSelectedRoomEnvelope(raw);
  return Boolean(parsed
    && parsed.backendRoomId === expected.backendRoomId
    && parsed.uiRoomLayoutId === expected.uiRoomLayoutId);
}

function parseRoomLayout(raw: string): RoomLayout | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isValidRoomFurnitureSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function assertValidSelectedRoomEnvelope(selection: SelectedRoomEnvelope): void {
  if (!parseSelectedRoomEnvelope(JSON.stringify(selection))) {
    throw new Error("Invalid selected Room envelope");
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
