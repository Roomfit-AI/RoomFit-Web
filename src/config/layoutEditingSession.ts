import type { LayoutResponse } from "../api/layouts";
import type { RoomLayout } from "../types";

const ACTIVE_LAYOUT_SESSION_KEY = "roomfit:activeLayoutEditingSession";
const SESSION_VERSION = 2;

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type LayoutEditingMode = "INITIAL_SETUP" | "REEDIT_DRAFT";

export interface ActiveLayoutEditingSession {
  version: 2;
  roomLayoutId: string;
  backendRoomId: number;
  activeLayoutId: number;
  sourceLayoutId: number | null;
  editingMode: LayoutEditingMode;
  confirmed: boolean;
  updatedAt: string;
}

export interface LayoutNavigationState {
  roomId: number;
  roomLayoutId: string;
  sourceLayoutId: number | null;
  activeLayoutId: number | null;
  editingMode: LayoutEditingMode;
  layoutResponse?: LayoutResponse;
  roomLayout?: RoomLayout;
}

export function readActiveLayoutEditingSession(
  storage: SessionStorage = localStorage,
): ActiveLayoutEditingSession | null {
  const raw = storage.getItem(ACTIVE_LAYOUT_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ActiveLayoutEditingSession>;
    if (
      parsed.version !== SESSION_VERSION
      || typeof parsed.roomLayoutId !== "string"
      || !parsed.roomLayoutId
      || !isPositiveInteger(parsed.backendRoomId)
      || !isPositiveInteger(parsed.activeLayoutId)
      || !(parsed.sourceLayoutId === null || isPositiveInteger(parsed.sourceLayoutId))
      || !isLayoutEditingMode(parsed.editingMode)
      || typeof parsed.confirmed !== "boolean"
      || typeof parsed.updatedAt !== "string"
      || Number.isNaN(Date.parse(parsed.updatedAt))
    ) {
      return null;
    }
    return parsed as ActiveLayoutEditingSession;
  } catch {
    return null;
  }
}

export function saveActiveLayoutEditingSession(
  session: Omit<ActiveLayoutEditingSession, "version" | "updatedAt">,
  storage: SessionStorage = localStorage,
): ActiveLayoutEditingSession {
  const next: ActiveLayoutEditingSession = {
    ...session,
    version: SESSION_VERSION,
    updatedAt: new Date().toISOString(),
  };
  storage.setItem(ACTIVE_LAYOUT_SESSION_KEY, JSON.stringify(next));
  return next;
}

export function saveLayoutResponseSession(
  roomLayoutId: string,
  response: LayoutResponse,
  storage: SessionStorage = localStorage,
  requestedMode?: LayoutEditingMode,
): ActiveLayoutEditingSession {
  const existing = readActiveLayoutEditingSession(storage);
  const matchingExisting = existing?.roomLayoutId === roomLayoutId
    && existing.backendRoomId === response.roomId
    ? existing
    : null;
  const editingMode = requestedMode
    ?? matchingExisting?.editingMode
    ?? (response.sourceLayoutId === null ? "INITIAL_SETUP" : "REEDIT_DRAFT");
  const sourceLayoutId = editingMode === "REEDIT_DRAFT"
    ? matchingExisting?.sourceLayoutId ?? response.sourceLayoutId
    : null;

  return saveActiveLayoutEditingSession({
    roomLayoutId,
    backendRoomId: response.roomId,
    activeLayoutId: response.layoutId,
    sourceLayoutId,
    editingMode,
    confirmed: response.confirmed,
  }, storage);
}

export function clearActiveLayoutEditingSession(storage: SessionStorage = localStorage): void {
  storage.removeItem(ACTIVE_LAYOUT_SESSION_KEY);
}

export function isSessionForRoom(
  session: ActiveLayoutEditingSession | null,
  roomLayoutId: string,
  backendRoomId: number,
): session is ActiveLayoutEditingSession {
  return Boolean(
    session
    && session.roomLayoutId === roomLayoutId
    && session.backendRoomId === backendRoomId,
  );
}

export function readLayoutNavigationState(value: unknown): LayoutNavigationState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LayoutNavigationState>;
  if (
    !isPositiveInteger(candidate.roomId)
    || typeof candidate.roomLayoutId !== "string"
    || !candidate.roomLayoutId
    || !(candidate.sourceLayoutId === null || isPositiveInteger(candidate.sourceLayoutId))
    || !(candidate.activeLayoutId === null || isPositiveInteger(candidate.activeLayoutId))
    || !isLayoutEditingMode(candidate.editingMode)
    || (candidate.roomLayout !== undefined && !isRoomLayout(candidate.roomLayout))
    || (candidate.layoutResponse !== undefined && !isLayoutResponse(candidate.layoutResponse))
  ) {
    return null;
  }
  return candidate as LayoutNavigationState;
}

export function createLayoutNavigationState(
  session: ActiveLayoutEditingSession,
  response?: LayoutResponse,
  roomLayout?: RoomLayout,
): LayoutNavigationState {
  return {
    roomId: session.backendRoomId,
    roomLayoutId: session.roomLayoutId,
    sourceLayoutId: session.sourceLayoutId,
    activeLayoutId: session.activeLayoutId,
    editingMode: session.editingMode,
    ...(response ? { layoutResponse: response } : {}),
    ...(roomLayout ? { roomLayout } : {}),
  };
}

export function createInitialSetupNavigationState(
  roomLayoutId: string,
  backendRoomId: number,
  roomLayout?: RoomLayout,
): LayoutNavigationState {
  return {
    roomId: backendRoomId,
    roomLayoutId,
    sourceLayoutId: null,
    activeLayoutId: null,
    editingMode: "INITIAL_SETUP",
    ...(roomLayout ? { roomLayout } : {}),
  };
}

export function resolveEditorInitialRoomLayout({
  navigationState,
  activeSession,
  selectedRoomLayout,
  liveMirror,
}: {
  navigationState: LayoutNavigationState | null;
  activeSession: ActiveLayoutEditingSession | null;
  selectedRoomLayout: RoomLayout | null;
  liveMirror: RoomLayout | null;
}): RoomLayout | null {
  if (navigationState?.roomLayout) return navigationState.roomLayout;
  if (activeSession) return null;
  return liveMirror ?? selectedRoomLayout;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isLayoutEditingMode(value: unknown): value is LayoutEditingMode {
  return value === "INITIAL_SETUP" || value === "REEDIT_DRAFT";
}

function isRoomLayout(value: unknown): value is RoomLayout {
  const candidate = value as Partial<RoomLayout>;
  return Boolean(candidate && typeof candidate.id === "string" && Array.isArray(candidate.furniture));
}

function isLayoutResponse(value: unknown): value is LayoutResponse {
  const candidate = value as Partial<LayoutResponse>;
  return Boolean(candidate && isPositiveInteger(candidate.layoutId) && Array.isArray(candidate.recommendedFurniture));
}
