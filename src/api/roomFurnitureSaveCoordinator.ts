import { useSyncExternalStore } from "react";

import {
  assertValidRoomFurnitureSnapshot,
  BrowserRoomFurnitureSaveDraftStore,
  cloneRoomFurnitureSnapshot,
  type PersistedRoomFurnitureSaveDraft,
  type RoomFurnitureSaveDraftStore,
} from "./roomFurnitureSaveDraft";
import { updateSelectedRoomSnapshot } from "./roomSelectionStorage";
import { updateRoomFurniture } from "./rooms";
import { assertActiveLayoutEditingAllowed } from "./layoutWorkflow";
import type { RoomLayout } from "../types";

export interface ActiveRoomFurnitureSaveSession {
  ownerBackendRoomId: number;
  ownerUiRoomLayoutId: string;
}

export interface ActiveRoomFurnitureSaveState {
  session: ActiveRoomFurnitureSaveSession | null;
  hasPending: boolean;
  isSaving: boolean;
  error: Error | null;
  latestRevision: number;
}

export type RoomFurnitureSaveRecoveryResult =
  | { status: "none" }
  | { status: "recovered"; revision: number; snapshot: RoomLayout }
  | { status: "discarded-foreign" }
  | { status: "discarded-invalid" };

/** Implementations must honor AbortSignal so timed-out writes cannot finish later. */
export type RoomFurnitureSaveTransport = (
  ownerBackendRoomId: number,
  snapshot: RoomLayout,
  signal: AbortSignal,
) => Promise<void>;

export interface RoomFurnitureMirrorStore {
  save(snapshot: RoomLayout): void;
}

interface RoomFurnitureSaveTask {
  revision: number;
  snapshot: RoomLayout;
}

interface FlushWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
}

interface ActiveRoomFurnitureSave {
  session: ActiveRoomFurnitureSaveSession;
  latestRevision: number;
  activeTask: RoomFurnitureSaveTask | null;
  queuedTask: RoomFurnitureSaveTask | null;
  error: Error | null;
  flushWaiters: Set<FlushWaiter>;
}

type StateListener = () => void;

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const INACTIVE_STATE: ActiveRoomFurnitureSaveState = {
  session: null,
  hasPending: false,
  isSaving: false,
  error: null,
  latestRevision: 0,
};

class BrowserRoomFurnitureMirrorStore implements RoomFurnitureMirrorStore {
  save(snapshot: RoomLayout): void {
    updateSelectedRoomSnapshot(snapshot);
  }
}

export class RoomFurnitureSaveCoordinator {
  private active: ActiveRoomFurnitureSave | null = null;
  private state: ActiveRoomFurnitureSaveState = INACTIVE_STATE;
  private readonly stateListeners = new Set<StateListener>();
  private readonly transport: RoomFurnitureSaveTransport;
  private readonly draftStore: RoomFurnitureSaveDraftStore;
  private readonly mirrorStore: RoomFurnitureMirrorStore;
  private readonly requestTimeoutMs: number;

  constructor(
    transport: RoomFurnitureSaveTransport,
    draftStore: RoomFurnitureSaveDraftStore,
    mirrorStore: RoomFurnitureMirrorStore,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ) {
    if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
      throw new Error("Room furniture save timeout must be a positive number");
    }
    this.transport = transport;
    this.draftStore = draftStore;
    this.mirrorStore = mirrorStore;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  setActiveSession(session: ActiveRoomFurnitureSaveSession): void {
    assertValidSession(session);
    const current = this.active;
    if (current && hasSameRoomOwner(current.session, session)) {
      return;
    }
    if (current && (this.hasPending(current) || current.error)) {
      throw new Error("Cannot replace an active Room save with pending or failed work");
    }

    this.resolveWaiters(current);
    this.active = createActiveSave(session);
    this.publishState();
  }

  enqueue(snapshot: RoomLayout): number {
    const active = this.requireActive();
    assertSnapshotOwner(snapshot, active.session);
    assertValidRoomFurnitureSnapshot(snapshot);

    let previousDraft = this.readDraftOrThrow();
    if (previousDraft && !hasSameRoomOwner(previousDraft, active.session)) {
      this.removeDraftOrThrow(previousDraft.revision);
      previousDraft = null;
    }
    const baseRevision = previousDraft && hasSameRoomOwner(previousDraft, active.session)
      ? previousDraft.revision
      : 0;
    const task: RoomFurnitureSaveTask = {
      revision: Math.max(active.latestRevision, baseRevision) + 1,
      snapshot: cloneRoomFurnitureSnapshot(snapshot),
    };

    try {
      this.draftStore.save(toPersistedDraft(active.session, task));
      this.mirrorStore.save(task.snapshot);
    } catch (error) {
      this.restoreDraftAfterPreparationFailure(previousDraft, task.revision);
      active.error = toError(error);
      this.publishState();
      this.settleWaiters(active);
      throw active.error;
    }

    active.latestRevision = task.revision;
    active.queuedTask = task;
    active.error = null;
    this.publishState();
    this.startNext(active);
    return task.revision;
  }

  recover(): RoomFurnitureSaveRecoveryResult {
    const active = this.requireActive();
    const result = this.draftStore.read();
    if (result.status === "none") {
      return { status: "none" };
    }
    if (result.status === "discarded-invalid") {
      return { status: "discarded-invalid" };
    }
    if (result.status === "storage-error") {
      active.error = result.error;
      this.publishState();
      throw result.error;
    }

    const { draft } = result;
    if (!hasSameRoomOwner(draft, active.session)) {
      this.removeDraftOrThrow(draft.revision);
      return { status: "discarded-foreign" };
    }

    if (active.activeTask || active.queuedTask) {
      return {
        status: "recovered",
        revision: active.latestRevision,
        snapshot: cloneRoomFurnitureSnapshot(draft.snapshot),
      };
    }

    try {
      this.mirrorStore.save(draft.snapshot);
    } catch (error) {
      active.error = toError(error);
      this.publishState();
      throw active.error;
    }

    const task: RoomFurnitureSaveTask = {
      revision: Math.max(draft.revision, active.latestRevision + 1),
      snapshot: cloneRoomFurnitureSnapshot(draft.snapshot),
    };
    if (task.revision !== draft.revision) {
      this.draftStore.save(toPersistedDraft(active.session, task));
    }
    active.latestRevision = task.revision;
    active.queuedTask = task;
    active.error = null;
    this.publishState();
    this.startNext(active);
    return { status: "recovered", revision: task.revision, snapshot: cloneRoomFurnitureSnapshot(task.snapshot) };
  }

  flush(): Promise<void> {
    const active = this.active;
    if (!active) {
      return Promise.resolve();
    }
    if (active.error && active.queuedTask) {
      active.error = null;
      this.publishState();
      this.startNext(active);
    }
    return this.waitFor(active);
  }

  retry(): Promise<void> {
    return this.flush();
  }

  getState(): ActiveRoomFurnitureSaveState {
    return this.state;
  }

  getPersistedDraft(): PersistedRoomFurnitureSaveDraft | null {
    const result = this.draftStore.read();
    if (result.status === "storage-error") {
      throw result.error;
    }
    return result.status === "valid" ? result.draft : null;
  }

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  clear(): boolean {
    const active = this.active;
    if (active && this.hasPending(active)) {
      throw new Error("Cannot clear an active Room save with pending work");
    }
    this.resolveWaiters(active);
    this.active = null;
    this.publishState();
    return this.removeAnyDraft();
  }

  clearIfOwned(expected: ActiveRoomFurnitureSaveSession): boolean {
    assertValidSession(expected);
    const active = this.active;
    if (active && !hasSameRoomOwner(active.session, expected)) {
      return false;
    }
    if (active && this.hasPending(active)) {
      throw new Error("Cannot clear an active Room save with pending work");
    }

    const draft = this.getPersistedDraft();
    if (!active && draft && !hasSameRoomOwner(draft, expected)) {
      return false;
    }
    this.resolveWaiters(active);
    this.active = null;
    this.publishState();
    if (draft && hasSameRoomOwner(draft, expected)) {
      return this.removeDraft(draft.revision);
    }
    return true;
  }

  discardPersistedDraftIfOwned(expected: ActiveRoomFurnitureSaveSession): boolean {
    assertValidSession(expected);
    const draft = this.getPersistedDraft();
    if (!draft || !hasSameRoomOwner(draft, expected)) {
      return true;
    }
    return this.removeDraft(draft.revision);
  }

  private requireActive(): ActiveRoomFurnitureSave {
    if (!this.active) {
      throw new Error("No active Room furniture save session");
    }
    return this.active;
  }

  private startNext(active: ActiveRoomFurnitureSave): void {
    if (this.active !== active || active.error || active.activeTask || !active.queuedTask) {
      return;
    }
    const task = active.queuedTask;
    active.queuedTask = null;
    active.activeTask = task;
    this.publishState();
    void this.runTask(active, task);
  }

  private async runTask(active: ActiveRoomFurnitureSave, task: RoomFurnitureSaveTask): Promise<void> {
    try {
      await this.executeTransport(active.session, task);
      if (this.active !== active) {
        return;
      }

      active.activeTask = null;
      active.error = null;
      if (!this.removeDraft(task.revision)) {
        throw new Error("Room furniture draft could not be cleared after saving");
      }
      this.publishState();
      this.startNext(active);
      this.settleWaiters(active);
    } catch (error) {
      if (this.active !== active) {
        return;
      }
      active.activeTask = null;
      if (!active.queuedTask) {
        active.queuedTask = task;
      }
      active.error = toError(error);
      this.publishState();
      this.settleWaiters(active);
    }
  }

  private executeTransport(session: ActiveRoomFurnitureSaveSession, task: RoomFurnitureSaveTask): Promise<void> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Room furniture save timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);
    });
    return Promise.race([
      this.transport(session.ownerBackendRoomId, cloneRoomFurnitureSnapshot(task.snapshot), controller.signal),
      timeout,
    ]).finally(() => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    });
  }

  private waitFor(active: ActiveRoomFurnitureSave): Promise<void> {
    if (this.active !== active || !this.hasPending(active)) {
      return active.error ? Promise.reject(active.error) : Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => active.flushWaiters.add({ resolve, reject }));
  }

  private settleWaiters(active: ActiveRoomFurnitureSave): void {
    if (this.active !== active || active.activeTask) {
      return;
    }
    if (active.error) {
      active.flushWaiters.forEach(({ reject }) => reject(active.error as Error));
      active.flushWaiters.clear();
      return;
    }
    if (!active.queuedTask) {
      this.resolveWaiters(active);
    }
  }

  private hasPending(active: ActiveRoomFurnitureSave): boolean {
    return Boolean(active.activeTask || active.queuedTask);
  }

  private readDraftOrThrow(): PersistedRoomFurnitureSaveDraft | null {
    const result = this.draftStore.read();
    if (result.status === "storage-error") {
      throw result.error;
    }
    return result.status === "valid" ? result.draft : null;
  }

  private restoreDraftAfterPreparationFailure(
    previous: PersistedRoomFurnitureSaveDraft | null,
    failedRevision: number,
  ): void {
    try {
      if (previous) {
        this.draftStore.save(previous);
      } else {
        this.draftStore.remove(failedRevision);
      }
    } catch (error) {
      console.warn("Room 저장 준비 실패 후 draft를 복원하지 못했습니다.", error);
    }
  }

  private removeDraftOrThrow(revision: number): void {
    this.draftStore.remove(revision);
  }

  private removeDraft(revision: number): boolean {
    try {
      this.draftStore.remove(revision);
      return true;
    } catch (error) {
      console.warn("Room 저장 draft를 정리하지 못했습니다.", error);
      return false;
    }
  }

  private removeAnyDraft(): boolean {
    try {
      this.draftStore.remove();
      return true;
    } catch (error) {
      console.warn("Room 저장 draft를 정리하지 못했습니다.", error);
      return false;
    }
  }

  private resolveWaiters(active: ActiveRoomFurnitureSave | null): void {
    active?.flushWaiters.forEach(({ resolve }) => resolve());
    active?.flushWaiters.clear();
  }

  private publishState(): void {
    const active = this.active;
    this.state = active
      ? {
          session: { ...active.session },
          hasPending: this.hasPending(active),
          isSaving: Boolean(active.activeTask),
          error: active.error,
          latestRevision: active.latestRevision,
        }
      : INACTIVE_STATE;
    this.stateListeners.forEach((listener) => safelyNotify(listener));
  }
}

const defaultRoomFurnitureSaveCoordinator = new RoomFurnitureSaveCoordinator(
  (ownerBackendRoomId, snapshot, signal) => updateRoomFurniture(
    ownerBackendRoomId,
    snapshot.furniture,
    snapshot.width,
    snapshot.depth,
    signal,
  ),
  new BrowserRoomFurnitureSaveDraftStore(),
  new BrowserRoomFurnitureMirrorStore(),
);

export function setActiveRoomFurnitureSaveSession(session: ActiveRoomFurnitureSaveSession): void {
  defaultRoomFurnitureSaveCoordinator.setActiveSession(session);
}

export function enqueueActiveRoomFurnitureSave(snapshot: RoomLayout): number {
  assertActiveLayoutEditingAllowed();
  return defaultRoomFurnitureSaveCoordinator.enqueue(snapshot);
}

export function recoverActiveRoomFurnitureSave(): RoomFurnitureSaveRecoveryResult {
  return defaultRoomFurnitureSaveCoordinator.recover();
}

export function flushActiveRoomFurnitureSave(): Promise<void> {
  return defaultRoomFurnitureSaveCoordinator.flush();
}

export function retryActiveRoomFurnitureSave(): Promise<void> {
  return defaultRoomFurnitureSaveCoordinator.retry();
}

export function getActiveRoomFurnitureSaveState(): ActiveRoomFurnitureSaveState {
  return defaultRoomFurnitureSaveCoordinator.getState();
}

export function getPersistedRoomFurnitureSaveDraft(): PersistedRoomFurnitureSaveDraft | null {
  return defaultRoomFurnitureSaveCoordinator.getPersistedDraft();
}

export function subscribeActiveRoomFurnitureSaveState(listener: StateListener): () => void {
  return defaultRoomFurnitureSaveCoordinator.subscribeState(listener);
}

export function clearActiveRoomFurnitureSaveState(): boolean {
  return defaultRoomFurnitureSaveCoordinator.clear();
}

export function clearActiveRoomFurnitureSaveStateIfOwned(session: ActiveRoomFurnitureSaveSession): boolean {
  return defaultRoomFurnitureSaveCoordinator.clearIfOwned(session);
}

export function discardPersistedRoomFurnitureSaveDraftIfOwned(
  session: ActiveRoomFurnitureSaveSession,
): boolean {
  return defaultRoomFurnitureSaveCoordinator.discardPersistedDraftIfOwned(session);
}

export function useActiveRoomFurnitureSaveState(): ActiveRoomFurnitureSaveState {
  return useSyncExternalStore(
    subscribeActiveRoomFurnitureSaveState,
    getActiveRoomFurnitureSaveState,
    getActiveRoomFurnitureSaveState,
  );
}

function createActiveSave(session: ActiveRoomFurnitureSaveSession): ActiveRoomFurnitureSave {
  return {
    session: { ...session },
    latestRevision: 0,
    activeTask: null,
    queuedTask: null,
    error: null,
    flushWaiters: new Set<FlushWaiter>(),
  };
}

function toPersistedDraft(
  session: ActiveRoomFurnitureSaveSession,
  task: RoomFurnitureSaveTask,
): PersistedRoomFurnitureSaveDraft {
  return {
    version: 1,
    ownerBackendRoomId: session.ownerBackendRoomId,
    ownerUiRoomLayoutId: session.ownerUiRoomLayoutId,
    revision: task.revision,
    dirty: true,
    updatedAt: new Date().toISOString(),
    snapshot: cloneRoomFurnitureSnapshot(task.snapshot),
  };
}

function assertValidSession(session: ActiveRoomFurnitureSaveSession): void {
  if (
    !Number.isInteger(session.ownerBackendRoomId)
    || session.ownerBackendRoomId <= 0
    || !session.ownerUiRoomLayoutId.trim()
  ) {
    throw new Error("Invalid Room furniture save session");
  }
}

function assertSnapshotOwner(snapshot: RoomLayout, session: ActiveRoomFurnitureSaveSession): void {
  if (snapshot.id !== session.ownerUiRoomLayoutId) {
    throw new Error("Room snapshot belongs to a different UI room");
  }
}

function hasSameRoomOwner(
  first: Pick<ActiveRoomFurnitureSaveSession, "ownerBackendRoomId" | "ownerUiRoomLayoutId">,
  second: Pick<ActiveRoomFurnitureSaveSession, "ownerBackendRoomId" | "ownerUiRoomLayoutId">,
): boolean {
  return first.ownerBackendRoomId === second.ownerBackendRoomId
    && first.ownerUiRoomLayoutId === second.ownerUiRoomLayoutId;
}

function safelyNotify(listener: () => void): void {
  try {
    listener();
  } catch (error) {
    console.error("Room furniture save subscriber failed", error);
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
