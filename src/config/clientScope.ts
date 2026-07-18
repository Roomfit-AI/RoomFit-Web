export const CLIENT_ID_HEADER = "X-RoomFit-Client-Id";
export const BROWSER_CLIENT_ID_KEY = "roomfit:browserClientId:v1";
export const ACTIVE_CLIENT_SCOPE_KEY = "roomfit:activeClientScope:v1";
export const PENDING_CLIENT_HANDOFF_KEY = "roomfit:pendingClientHandoff:v1";

const CLIENT_SCOPE_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ClientScopeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ClientScopeMode = "APP_UUID" | "LEGACY_HANDOFF" | "BROWSER_UUID";

export interface ActiveClientScope {
  version: 1;
  mode: ClientScopeMode;
  clientId: string | null;
  setupSessionId: string | null;
  backendRoomId: number | null;
  roomLayoutId: string | null;
}

export interface PendingClientHandoff {
  version: 1;
  mode: "APP_UUID" | "LEGACY_HANDOFF";
  clientId: string | null;
  backendRoomId: number;
}

export function validateClientId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export function normalizeClientId(value: unknown): string | null {
  return validateClientId(value) ? value.trim().toLowerCase() : null;
}

export function getStoredBrowserClientId(
  storage: ClientScopeStorage = localStorage,
): string | null {
  try {
    const raw = storage.getItem(BROWSER_CLIENT_ID_KEY);
    const clientId = normalizeClientId(raw);
    if (raw && !clientId) storage.removeItem(BROWSER_CLIENT_ID_KEY);
    return clientId;
  } catch {
    return null;
  }
}

export function getOrCreateBrowserClientId(
  storage: ClientScopeStorage = localStorage,
  createUuid: () => string = () => crypto.randomUUID(),
): string {
  const existing = getStoredBrowserClientId(storage);
  if (existing) return existing;

  const clientId = normalizeClientId(createUuid());
  if (!clientId) throw new Error("브라우저 Client ID를 생성하지 못했습니다.");
  storage.setItem(BROWSER_CLIENT_ID_KEY, clientId);
  return clientId;
}

export function resolveClientScopeForHandoff(input: {
  roomId: unknown;
  clientId: unknown;
}): PendingClientHandoff | null {
  const backendRoomId = normalizeRoomId(input.roomId);
  if (backendRoomId === null) return null;

  const clientId = normalizeClientId(input.clientId);
  return {
    version: CLIENT_SCOPE_VERSION,
    mode: clientId ? "APP_UUID" : "LEGACY_HANDOFF",
    clientId,
    backendRoomId,
  };
}

export function savePendingClientHandoff(
  handoff: PendingClientHandoff,
  browserSession: ClientScopeStorage = sessionStorage,
): void {
  browserSession.setItem(PENDING_CLIENT_HANDOFF_KEY, JSON.stringify(handoff));
}

export function readPendingClientHandoff(
  browserSession: ClientScopeStorage = sessionStorage,
): PendingClientHandoff | null {
  return readJson(browserSession, PENDING_CLIENT_HANDOFF_KEY, parsePendingClientHandoff);
}

export function clearPendingClientHandoff(
  browserSession: Pick<ClientScopeStorage, "removeItem"> = sessionStorage,
): void {
  browserSession.removeItem(PENDING_CLIENT_HANDOFF_KEY);
}

export function readActiveClientScope(
  browserSession: ClientScopeStorage = sessionStorage,
): ActiveClientScope | null {
  return readJson(browserSession, ACTIVE_CLIENT_SCOPE_KEY, parseActiveClientScope);
}

export function activateBrowserClientScope(
  setupSessionId: string | null,
  storage: ClientScopeStorage = localStorage,
  browserSession: ClientScopeStorage = sessionStorage,
): ActiveClientScope {
  return saveActiveClientScope({
    version: CLIENT_SCOPE_VERSION,
    mode: "BROWSER_UUID",
    clientId: getOrCreateBrowserClientId(storage),
    setupSessionId,
    backendRoomId: null,
    roomLayoutId: null,
  }, browserSession);
}

export function activateLegacyClientScope(
  setupSessionId: string,
  backendRoomId: number,
  roomLayoutId: string,
  browserSession: ClientScopeStorage = sessionStorage,
): ActiveClientScope {
  return saveActiveClientScope({
    version: CLIENT_SCOPE_VERSION,
    mode: "LEGACY_HANDOFF",
    clientId: null,
    setupSessionId,
    backendRoomId,
    roomLayoutId,
  }, browserSession);
}

export function activatePendingHandoffScope(
  handoff: PendingClientHandoff,
  setupSessionId: string,
  roomLayoutId: string,
  browserSession: ClientScopeStorage = sessionStorage,
): ActiveClientScope {
  return saveActiveClientScope({
    version: CLIENT_SCOPE_VERSION,
    mode: handoff.mode,
    clientId: handoff.clientId,
    setupSessionId,
    backendRoomId: handoff.backendRoomId,
    roomLayoutId,
  }, browserSession);
}

export function bindActiveClientScopeToRoom(
  setupSessionId: string,
  roomLayoutId: string,
  backendRoomId: number | null,
  storage: ClientScopeStorage = localStorage,
  browserSession: ClientScopeStorage = sessionStorage,
): ActiveClientScope {
  const current = readActiveClientScope(browserSession);
  const matching = current?.setupSessionId === setupSessionId;
  const base = matching
    ? current
    : activateBrowserClientScope(setupSessionId, storage, browserSession);

  return saveActiveClientScope({
    ...base,
    setupSessionId,
    roomLayoutId,
    backendRoomId,
  }, browserSession);
}

export function getActiveRequestClientId(
  storage: ClientScopeStorage = localStorage,
  browserSession: ClientScopeStorage = sessionStorage,
): string | null {
  const pending = readPendingClientHandoff(browserSession);
  if (pending) return pending.mode === "APP_UUID" ? pending.clientId : null;

  const active = readActiveClientScope(browserSession);
  if (active) return active.mode === "LEGACY_HANDOFF" ? null : active.clientId;

  try {
    return getOrCreateBrowserClientId(storage);
  } catch {
    return null;
  }
}

function saveActiveClientScope(
  scope: ActiveClientScope,
  browserSession: ClientScopeStorage,
): ActiveClientScope {
  browserSession.setItem(ACTIVE_CLIENT_SCOPE_KEY, JSON.stringify(scope));
  return scope;
}

function parsePendingClientHandoff(value: unknown): PendingClientHandoff | null {
  const backendRoomId = isRecord(value) ? normalizeRoomId(value.backendRoomId) : null;
  if (!isRecord(value)
    || value.version !== CLIENT_SCOPE_VERSION
    || !(value.mode === "APP_UUID" || value.mode === "LEGACY_HANDOFF")
    || backendRoomId === null) {
    return null;
  }

  const clientId = normalizeClientId(value.clientId);
  if ((value.mode === "APP_UUID" && !clientId)
    || (value.mode === "LEGACY_HANDOFF" && value.clientId !== null)) {
    return null;
  }

  return {
    version: CLIENT_SCOPE_VERSION,
    mode: value.mode,
    clientId,
    backendRoomId,
  };
}

function parseActiveClientScope(value: unknown): ActiveClientScope | null {
  const backendRoomId = isRecord(value) && value.backendRoomId !== null
    ? normalizeRoomId(value.backendRoomId)
    : null;
  if (!isRecord(value)
    || value.version !== CLIENT_SCOPE_VERSION
    || !(value.mode === "APP_UUID" || value.mode === "LEGACY_HANDOFF" || value.mode === "BROWSER_UUID")
    || !(value.setupSessionId === null || (typeof value.setupSessionId === "string" && value.setupSessionId))
    || !(value.backendRoomId === null || backendRoomId !== null)
    || !(value.roomLayoutId === null || (typeof value.roomLayoutId === "string" && value.roomLayoutId))) {
    return null;
  }

  const clientId = normalizeClientId(value.clientId);
  if ((value.mode === "LEGACY_HANDOFF" && value.clientId !== null)
    || (value.mode !== "LEGACY_HANDOFF" && !clientId)) {
    return null;
  }

  return {
    version: CLIENT_SCOPE_VERSION,
    mode: value.mode,
    clientId,
    setupSessionId: value.setupSessionId as string | null,
    backendRoomId,
    roomLayoutId: value.roomLayoutId as string | null,
  };
}

function readJson<T>(
  storage: ClientScopeStorage,
  key: string,
  parse: (value: unknown) => T | null,
): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = parse(JSON.parse(raw));
    if (!parsed) storage.removeItem(key);
    return parsed;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be unavailable; request handling will safely omit the header.
    }
    return null;
  }
}

function normalizeRoomId(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof parsed === "number" && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
