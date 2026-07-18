import { normalizeBackendRoomId } from "../api/agentContextRequest";
import { CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY } from "../api/customRoomBackend";
import { uploadRoomLayout } from "../api/rooms";
import type { RoomLayout } from "../types";
import {
  clearActiveLayoutEditingSession,
  isSessionForRoom,
  readActiveLayoutEditingSession,
} from "./layoutEditingSession";
import {
  applyPreferencesToStorage,
  getRoomPreferences,
  normalizeRoomPreferences,
} from "./roomPreferences";

const ROOM_SETUP_SESSION_KEY = "roomfit:roomSetupSession";
const RECOMMENDATION_RESULT_KEY = "roomfit:recommendationResult";
const SESSION_VERSION = 1;

const TEMPORARY_LOCAL_KEYS = [
  "roomfit:backendRoomId",
  "roomfit:selectedRoomId",
  "roomfit:selectedRoomTitle",
  "roomfit:selectedRoomType",
  "roomfit:selectedRoomSize",
  "roomfit:selectedRoomLayout",
  "roomfit:selectedPurpose",
  "roomfit:selectedPalette",
  "roomfit:selectedStyle",
  "roomfit:selectedAdditionalFurnitureIds",
  "roomfit:confirmedRoomLayout",
  CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY,
] as const;

const SETUP_VISITED_KEYS = [
  "roomfit:visited:rooms",
  "roomfit:visited:preference",
  "roomfit:visited:reference-image",
  "roomfit:visited:add-furniture",
  RECOMMENDATION_RESULT_KEY,
] as const;

type SetupStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type RoomSetupMode = "NEW" | "REEDIT";

export interface RoomSetupSession {
  version: 1;
  sessionId: string;
  roomLayoutId: string | null;
  backendRoomId: number | null;
  mode: RoomSetupMode | null;
  createdAt: string;
}

export interface PreparedRoomSetup {
  created: boolean;
  roomLayoutId: string;
  backendRoomId: number;
}

export function beginNewRoomSetup(
  storage: SetupStorage = localStorage,
  browserSession: SetupStorage = sessionStorage,
  sessionId = createSessionId(),
): RoomSetupSession {
  TEMPORARY_LOCAL_KEYS.forEach((key) => storage.removeItem(key));
  SETUP_VISITED_KEYS.forEach((key) => browserSession.removeItem(key));
  clearActiveLayoutEditingSession(storage);

  const session: RoomSetupSession = {
    version: SESSION_VERSION,
    sessionId,
    roomLayoutId: null,
    backendRoomId: null,
    mode: null,
    createdAt: new Date().toISOString(),
  };
  browserSession.setItem(ROOM_SETUP_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function readRoomSetupSession(
  browserSession: Pick<SetupStorage, "getItem"> = sessionStorage,
): RoomSetupSession | null {
  const raw = browserSession.getItem(ROOM_SETUP_SESSION_KEY);
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)
      || value.version !== SESSION_VERSION
      || typeof value.sessionId !== "string"
      || !value.sessionId
      || !(value.roomLayoutId === null || typeof value.roomLayoutId === "string")
      || !(value.backendRoomId === null || normalizeBackendRoomId(value.backendRoomId) !== null)
      || !(value.mode === null || value.mode === "NEW" || value.mode === "REEDIT")
      || typeof value.createdAt !== "string"
      || Number.isNaN(Date.parse(value.createdAt))) {
      return null;
    }
    return value as unknown as RoomSetupSession;
  } catch {
    return null;
  }
}

export function initializeRoomSetupSession(
  storage: SetupStorage = localStorage,
  browserSession: SetupStorage = sessionStorage,
): RoomSetupSession {
  return readRoomSetupSession(browserSession) ?? beginNewRoomSetup(storage, browserSession);
}

export function bindRoomToSetupSession(
  roomLayoutId: string,
  backendRoomId: number | null,
  mode: RoomSetupMode,
  storage: SetupStorage = localStorage,
  browserSession: SetupStorage = sessionStorage,
): RoomSetupSession {
  const activeLayout = readActiveLayoutEditingSession(storage);
  if (activeLayout && (backendRoomId === null || !isSessionForRoom(activeLayout, roomLayoutId, backendRoomId))) {
    clearActiveLayoutEditingSession(storage);
  }

  const current = readRoomSetupSession(browserSession) ?? beginNewRoomSetup(storage, browserSession);
  if (current.roomLayoutId !== null
    && (current.roomLayoutId !== roomLayoutId || current.backendRoomId !== backendRoomId)) {
    browserSession.removeItem(RECOMMENDATION_RESULT_KEY);
  }
  const next: RoomSetupSession = {
    ...current,
    roomLayoutId,
    backendRoomId,
    mode,
  };
  browserSession.setItem(ROOM_SETUP_SESSION_KEY, JSON.stringify(next));
  return next;
}

export function completeRoomSetupSession(
  browserSession: Pick<SetupStorage, "removeItem"> = sessionStorage,
): void {
  browserSession.removeItem(ROOM_SETUP_SESSION_KEY);
  browserSession.removeItem(RECOMMENDATION_RESULT_KEY);
}

export function getSelectedRoomIdForSetup(
  storage: Pick<SetupStorage, "getItem"> = localStorage,
  browserSession: SetupStorage = sessionStorage,
): string {
  const session = readRoomSetupSession(browserSession);
  const selectedRoomId = storage.getItem("roomfit:selectedRoomId");
  return session?.roomLayoutId && selectedRoomId === session.roomLayoutId ? selectedRoomId : "";
}

export function restoreRoomPreferencesForSetup(
  roomLayoutId: string,
  mode: RoomSetupMode,
  storage: SetupStorage = localStorage,
): void {
  const preferences = mode === "REEDIT"
    ? getRoomPreferences(roomLayoutId, storage)
    : normalizeRoomPreferences(null);
  applyPreferencesToStorage(preferences, storage);
}

export async function prepareSelectedRoomForManagement(
  storage: SetupStorage = localStorage,
  browserSession: SetupStorage = sessionStorage,
  createRoom: (room: RoomLayout) => Promise<number> = uploadRoomLayout,
): Promise<PreparedRoomSetup> {
  const room = readSelectedRoomLayout(storage.getItem("roomfit:selectedRoomLayout"));
  const selectedRoomLayoutId = storage.getItem("roomfit:selectedRoomId");
  if (!room || !selectedRoomLayoutId || room.id !== selectedRoomLayoutId) {
    throw new Error("먼저 방을 선택해 주세요.");
  }

  const existingRoomId = normalizeBackendRoomId(storage.getItem("roomfit:backendRoomId"));
  if (existingRoomId !== null) {
    bindRoomToSetupSession(room.id, existingRoomId, "REEDIT", storage, browserSession);
    return { created: false, roomLayoutId: room.id, backendRoomId: existingRoomId };
  }

  if (room.source !== "SAMPLE" && room.source !== "CUSTOM") {
    throw new Error("새로 생성할 수 있는 방 정보가 아닙니다.");
  }

  const backendRoomId = normalizeBackendRoomId(await createRoom(room));
  if (backendRoomId === null) {
    throw new Error("Backend가 유효한 새 roomId를 반환하지 않았습니다.");
  }

  const roomLayoutId = `api-room-${backendRoomId}`;
  const createdRoom: RoomLayout = {
    ...room,
    id: roomLayoutId,
    source: "ROOMPLAN",
    createdAt: new Date().toISOString(),
  };
  storage.setItem("roomfit:backendRoomId", String(backendRoomId));
  storage.setItem("roomfit:selectedRoomId", roomLayoutId);
  storage.setItem("roomfit:selectedRoomLayout", JSON.stringify(createdRoom));
  storage.removeItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY);
  bindRoomToSetupSession(roomLayoutId, backendRoomId, "NEW", storage, browserSession);

  return { created: true, roomLayoutId, backendRoomId };
}

function readSelectedRoomLayout(raw: string | null): RoomLayout | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value)
      && typeof value.id === "string"
      && typeof value.source === "string"
      && Array.isArray(value.furniture)
      ? value as unknown as RoomLayout
      : null;
  } catch {
    return null;
  }
}

function createSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `setup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
