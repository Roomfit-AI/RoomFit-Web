import { readSelectedRoomEnvelope } from "./roomSelectionStorage";
import { requireStorageWrite, safeStorageGet, safeStorageRemove, safeStorageSet } from "./safeStorage";

export type BackendLayoutId = number;
export type BackendRoomId = number;
export type UiRoomLayoutId = string;

export interface LayoutSession {
  version: 1;
  layoutId: BackendLayoutId;
  ownerBackendRoomId: BackendRoomId;
  ownerUiRoomLayoutId: UiRoomLayoutId;
}

export type LayoutOwnership = Pick<
  LayoutSession,
  "layoutId" | "ownerBackendRoomId" | "ownerUiRoomLayoutId"
>;

export interface LayoutSessionLookup {
  session: LayoutSession | null;
  migratedFromLegacy: boolean;
}

export type LayoutSessionReadResult =
  | { status: "valid"; session: LayoutSession }
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "storage-error"; error: Error };

const LAYOUT_SESSION_KEY = "roomfit:layoutSession:v1";
const LEGACY_LAYOUT_ID_KEY = "roomfit:backendLayoutId";
const LEGACY_LAYOUT_OWNER_KEY = "roomfit:backendLayoutRoomId";

export function readSelectedBackendRoomId(): BackendRoomId | null {
  const selected = readSelectedRoomEnvelope();
  return selected.status === "valid" ? selected.selection.backendRoomId : null;
}

export function readLayoutSession(): LayoutSession | null {
  const result = readLayoutSessionResult();
  return result.status === "valid" ? result.session : null;
}

export function readLayoutSessionResult(): LayoutSessionReadResult {
  const result = safeStorageGet("local", LAYOUT_SESSION_KEY);
  if (result.status === "missing" || result.status === "storage-error") {
    return result;
  }

  try {
    const raw = result.value;
    const parsed = JSON.parse(raw) as Partial<LayoutSession>;
    if (
      parsed.version !== 1
      || !isPositiveInteger(parsed.layoutId)
      || !isPositiveInteger(parsed.ownerBackendRoomId)
      || typeof parsed.ownerUiRoomLayoutId !== "string"
      || !parsed.ownerUiRoomLayoutId.trim()
    ) {
      return { status: "invalid" };
    }

    return { status: "valid", session: parsed as LayoutSession };
  } catch {
    return { status: "invalid" };
  }
}

export function readOrMigrateLayoutSession(
  ownerBackendRoomId: BackendRoomId,
  ownerUiRoomLayoutId: UiRoomLayoutId,
): LayoutSessionLookup {
  const current = readLayoutSession();
  if (current) {
    return { session: current, migratedFromLegacy: false };
  }

  const legacyLayoutIdResult = safeStorageGet("local", LEGACY_LAYOUT_ID_KEY);
  const legacyOwnerResult = safeStorageGet("local", LEGACY_LAYOUT_OWNER_KEY);
  if (legacyLayoutIdResult.status === "storage-error" || legacyOwnerResult.status === "storage-error") {
    return { session: null, migratedFromLegacy: false };
  }
  const legacyLayoutId = legacyLayoutIdResult.status === "success"
    ? toPositiveInteger(legacyLayoutIdResult.value)
    : null;
  const legacyOwnerUiRoomLayoutId = legacyOwnerResult.status === "success" ? legacyOwnerResult.value : null;

  if (!legacyLayoutId || legacyOwnerUiRoomLayoutId !== ownerUiRoomLayoutId) {
    return { session: null, migratedFromLegacy: false };
  }

  const session: LayoutSession = {
    version: 1,
    layoutId: legacyLayoutId,
    ownerBackendRoomId,
    ownerUiRoomLayoutId,
  };
  try {
    writeLayoutSession(session);
  } catch {
    return { session: null, migratedFromLegacy: false };
  }

  return { session, migratedFromLegacy: true };
}

export function writeLayoutSession(session: LayoutSession): void {
  requireStorageWrite(
    safeStorageSet("local", LAYOUT_SESSION_KEY, JSON.stringify(session)),
    "Layout session storage is unavailable",
  );
  if (!clearLegacyLayoutSession()) {
    console.warn("현재 Layout session은 저장했지만 이전 형식의 키를 정리하지 못했습니다.");
  }
}

export function clearLayoutSession(): void {
  requireStorageWrite(
    safeStorageRemove("local", LAYOUT_SESSION_KEY),
    "Layout session could not be removed",
  );
  if (!clearLegacyLayoutSession()) {
    throw new Error("Legacy Layout session could not be removed");
  }
}

export function clearLayoutSessionForOwner(ownerBackendRoomId: BackendRoomId): LayoutSession | null {
  const session = readLayoutSession();

  if (!session || session.ownerBackendRoomId !== ownerBackendRoomId) {
    return null;
  }

  clearLayoutSession();
  return session;
}

export function clearLayoutSessionForLayout(layoutId: BackendLayoutId): LayoutSession | null {
  const session = readLayoutSession();

  if (!session || session.layoutId !== layoutId) {
    return null;
  }

  clearLayoutSession();
  return session;
}

export function isLayoutSessionOwnedBy(
  session: LayoutSession,
  ownerBackendRoomId: BackendRoomId,
  ownerUiRoomLayoutId: UiRoomLayoutId,
): boolean {
  return isLayoutOwnershipForRoom(session, ownerBackendRoomId, ownerUiRoomLayoutId);
}

export function hasSameLayoutOwnership(
  first: LayoutOwnership,
  second: LayoutOwnership,
): boolean {
  return first.layoutId === second.layoutId
    && first.ownerBackendRoomId === second.ownerBackendRoomId
    && first.ownerUiRoomLayoutId === second.ownerUiRoomLayoutId;
}

export function isLayoutOwnershipForRoom(
  ownership: LayoutOwnership,
  ownerBackendRoomId: BackendRoomId,
  ownerUiRoomLayoutId: UiRoomLayoutId,
): boolean {
  return ownership.ownerBackendRoomId === ownerBackendRoomId
    && ownership.ownerUiRoomLayoutId === ownerUiRoomLayoutId;
}

export function toLayoutSession(ownership: LayoutOwnership): LayoutSession {
  return {
    version: 1,
    layoutId: ownership.layoutId,
    ownerBackendRoomId: ownership.ownerBackendRoomId,
    ownerUiRoomLayoutId: ownership.ownerUiRoomLayoutId,
  };
}

function clearLegacyLayoutSession(): boolean {
  const layoutRemoval = safeStorageRemove("local", LEGACY_LAYOUT_ID_KEY);
  const ownerRemoval = safeStorageRemove("local", LEGACY_LAYOUT_OWNER_KEY);
  return layoutRemoval.status === "success" && ownerRemoval.status === "success";
}

function toPositiveInteger(value: string | null): number | null {
  const parsed = Number(value);
  return isPositiveInteger(parsed) ? parsed : null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
