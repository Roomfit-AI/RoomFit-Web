import { hasSameLayoutOwnership, type LayoutSession } from "./layoutSession";
import { requireStorageWrite, safeStorageGet, safeStorageRemove, safeStorageSet } from "./safeStorage";

export const ALREADY_CONFIRMED_HTTP_STATUS = 409;
export const ALREADY_CONFIRMED_ERROR_CODE = "ALREADY_CONFIRMED";

export type LayoutConfirmAttemptStatus = "pending" | "confirmed";

export interface LayoutConfirmAttempt {
  version: 1;
  layoutId: number;
  ownerBackendRoomId: number;
  ownerUiRoomLayoutId: string;
  attemptedAt: string;
  status: LayoutConfirmAttemptStatus;
}

export interface LayoutConfirmErrorDescriptor {
  httpStatus: number | null;
  code: string | null;
}

export interface LayoutConfirmAttemptStore {
  read(): LayoutConfirmAttempt | null;
  readPersisted?(): LayoutConfirmAttempt | null;
  write(attempt: LayoutConfirmAttempt): void;
  remember(attempt: LayoutConfirmAttempt): void;
  remove(expected?: LayoutSession): boolean;
}

export interface ConfirmCleanupResult {
  complete: boolean;
  warnings: string[];
}

export interface ConfirmedSessionCleanupResult extends ConfirmCleanupResult {
  confirmed: boolean;
}

interface ConfirmCleanupActions {
  clearCoordinator: () => boolean;
  clearSession: () => void;
  preserveMarker?: boolean;
}

const CONFIRM_ATTEMPT_KEY = "roomfit:layoutConfirmAttempt:v1";

export class BrowserLayoutConfirmAttemptStore implements LayoutConfirmAttemptStore {
  private memory: LayoutConfirmAttempt | null | undefined;

  read(): LayoutConfirmAttempt | null {
    if (this.memory !== undefined) {
      return cloneAttempt(this.memory);
    }

    try {
      const attempt = this.readPersisted();
      this.memory = attempt;
      return cloneAttempt(attempt);
    } catch (error) {
      console.warn("배치 확정 기록을 읽지 못했습니다.", error);
      this.memory = null;
      return null;
    }
  }

  readPersisted(): LayoutConfirmAttempt | null {
    const result = safeStorageGet("local", CONFIRM_ATTEMPT_KEY);
    if (result.status === "storage-error") {
      throw result.error;
    }
    const raw = result.status === "success" ? result.value : null;
    const attempt = parseLayoutConfirmAttempt(raw);
    if (raw && !attempt) {
      const removal = safeStorageRemove("local", CONFIRM_ATTEMPT_KEY);
      if (removal.status === "storage-error") {
        console.warn("잘못된 배치 확정 기록을 제거하지 못했습니다.", removal.error);
      }
    }
    return attempt;
  }

  write(attempt: LayoutConfirmAttempt): void {
    requireStorageWrite(
      safeStorageSet("local", CONFIRM_ATTEMPT_KEY, JSON.stringify(attempt)),
      "Layout confirmation marker storage is unavailable",
    );
    this.memory = cloneAttempt(attempt);
  }

  remember(attempt: LayoutConfirmAttempt): void {
    this.memory = cloneAttempt(attempt);
  }

  remove(expected?: LayoutSession): boolean {
    const current = this.read();
    if (expected && current && !hasSameLayoutOwnership(current, expected)) {
      return true;
    }

    this.memory = null;
    try {
      requireStorageWrite(
        safeStorageRemove("local", CONFIRM_ATTEMPT_KEY),
        "Layout confirmation marker could not be removed",
      );
      return true;
    } catch (error) {
      this.memory = current;
      console.warn("배치 확정 기록을 제거하지 못했습니다.", error);
      return false;
    }
  }
}

const defaultConfirmAttemptStore = new BrowserLayoutConfirmAttemptStore();

export function beginLayoutConfirmAttempt(
  session: LayoutSession,
  store: LayoutConfirmAttemptStore = defaultConfirmAttemptStore,
  now = new Date(),
): LayoutConfirmAttempt {
  const attempt: LayoutConfirmAttempt = {
    version: 1,
    layoutId: session.layoutId,
    ownerBackendRoomId: session.ownerBackendRoomId,
    ownerUiRoomLayoutId: session.ownerUiRoomLayoutId,
    attemptedAt: now.toISOString(),
    status: "pending",
  };
  store.write(attempt);
  return attempt;
}

export function markLayoutConfirmAttemptConfirmed(
  session: LayoutSession,
  store: LayoutConfirmAttemptStore = defaultConfirmAttemptStore,
): { attempt: LayoutConfirmAttempt; persisted: boolean } {
  const current = store.read();
  const confirmed: LayoutConfirmAttempt = {
    version: 1,
    layoutId: session.layoutId,
    ownerBackendRoomId: session.ownerBackendRoomId,
    ownerUiRoomLayoutId: session.ownerUiRoomLayoutId,
    attemptedAt: current && hasSameLayoutOwnership(current, session)
      ? current.attemptedAt
      : new Date().toISOString(),
    status: "confirmed",
  };
  store.remember(confirmed);
  if (!current || !hasSameLayoutOwnership(current, session)) {
    console.warn("확정 attempt 기록이 바뀌어 완료 marker를 메모리에만 유지합니다.");
    return { attempt: confirmed, persisted: false };
  }
  try {
    store.write(confirmed);
    return { attempt: confirmed, persisted: true };
  } catch (error) {
    console.warn("확정 완료 기록을 영구 저장하지 못했습니다.", error);
    return { attempt: confirmed, persisted: false };
  }
}

export function readLayoutConfirmAttempt(
  store: LayoutConfirmAttemptStore = defaultConfirmAttemptStore,
): LayoutConfirmAttempt | null {
  return store.read();
}

export function isLayoutSessionConfirmed(
  session: LayoutSession,
  store: LayoutConfirmAttemptStore = defaultConfirmAttemptStore,
): boolean {
  const attempt = store.read();
  return Boolean(
    attempt
    && attempt.status === "confirmed"
    && hasSameLayoutOwnership(attempt, session),
  );
}

export function isLayoutSessionConfirmPending(
  session: LayoutSession,
  store: LayoutConfirmAttemptStore = defaultConfirmAttemptStore,
): boolean {
  const attempt = store.readPersisted ? store.readPersisted() : store.read();
  return Boolean(
    attempt
    && attempt.status === "pending"
    && hasSameLayoutOwnership(attempt, session),
  );
}

export function isLayoutSessionDurablyConfirmed(
  session: LayoutSession,
  store: LayoutConfirmAttemptStore = defaultConfirmAttemptStore,
): boolean {
  const attempt = store.readPersisted ? store.readPersisted() : store.read();
  return Boolean(
    attempt
    && attempt.status === "confirmed"
    && hasSameLayoutOwnership(attempt, session),
  );
}

export function shouldReconcileAlreadyConfirmed(
  session: LayoutSession,
  attempt: LayoutConfirmAttempt | null,
  error: LayoutConfirmErrorDescriptor,
): boolean {
  return error.httpStatus === ALREADY_CONFIRMED_HTTP_STATUS
    && error.code === ALREADY_CONFIRMED_ERROR_CODE
    && Boolean(attempt && hasSameLayoutOwnership(attempt, session));
}

export function cleanupConfirmedLayoutLocally(
  session: LayoutSession,
  actions: ConfirmCleanupActions,
  store: LayoutConfirmAttemptStore = defaultConfirmAttemptStore,
): ConfirmCleanupResult {
  const warnings: string[] = [];

  try {
    if (!actions.clearCoordinator()) {
      warnings.push("draft");
    }
  } catch {
    warnings.push("coordinator");
  }

  try {
    actions.clearSession();
  } catch {
    warnings.push("session");
  }

  if (warnings.length === 0 && !actions.preserveMarker && !store.remove(session)) {
    warnings.push("confirm-marker");
  }

  return {
    complete: warnings.length === 0,
    warnings,
  };
}

// A matching confirmed marker is authoritative even when stale local state
// could not be removed previously. Keep that marker as recovery evidence while
// best-effort discarding only the coordinator/session supplied by the caller.
export function discardConfirmedLayoutStaleState(
  session: LayoutSession,
  actions: ConfirmCleanupActions,
  store: LayoutConfirmAttemptStore = defaultConfirmAttemptStore,
): ConfirmedSessionCleanupResult {
  if (!isLayoutSessionDurablyConfirmed(session, store)) {
    return { confirmed: false, complete: true, warnings: [] };
  }

  const warnings: string[] = [];
  try {
    if (!actions.clearCoordinator()) {
      warnings.push("draft");
    }
  } catch {
    warnings.push("coordinator");
  }
  try {
    actions.clearSession();
  } catch {
    warnings.push("session");
  }

  return {
    confirmed: true,
    complete: warnings.length === 0,
    warnings,
  };
}

export function clearLayoutConfirmAttemptForOwner(
  ownerBackendRoomId: number,
  store: LayoutConfirmAttemptStore = defaultConfirmAttemptStore,
): boolean {
  const attempt = store.read();
  if (!attempt || attempt.ownerBackendRoomId !== ownerBackendRoomId) {
    return true;
  }
  return store.remove();
}

export function parseLayoutConfirmAttempt(raw: string | null): LayoutConfirmAttempt | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LayoutConfirmAttempt>;
    if (
      parsed.version !== 1
      || !isPositiveInteger(parsed.layoutId)
      || !isPositiveInteger(parsed.ownerBackendRoomId)
      || typeof parsed.ownerUiRoomLayoutId !== "string"
      || !parsed.ownerUiRoomLayoutId.trim()
      || (parsed.status !== "pending" && parsed.status !== "confirmed")
      || !isIsoTimestamp(parsed.attemptedAt)
    ) {
      return null;
    }
    return parsed as LayoutConfirmAttempt;
  } catch {
    return null;
  }
}

function cloneAttempt(attempt: LayoutConfirmAttempt | null): LayoutConfirmAttempt | null {
  return attempt ? { ...attempt } : null;
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
