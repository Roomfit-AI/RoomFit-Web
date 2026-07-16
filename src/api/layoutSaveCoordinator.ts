import { useSyncExternalStore } from "react";

import {
  isLayoutSessionConfirmed,
  isLayoutSessionConfirmPending,
  isLayoutSessionDurablyConfirmed,
} from "./layoutConfirmation";
import { updateLayout, type LayoutResponse } from "./layouts";
import {
  assertValidRoomLayout,
  BrowserLayoutSaveDraftStore,
  cloneRoomLayout,
  type LayoutSaveDraftStore,
  type PersistedLayoutSaveDraft,
} from "./layoutSaveDraft";
import {
  hasSameLayoutOwnership,
  type LayoutSession,
} from "./layoutSession";
import { assertActiveLayoutEditingAllowed } from "./layoutWorkflow";
import type { Furniture, RoomLayout } from "../types";

export type { LayoutSaveDraftStore, PersistedLayoutSaveDraft } from "./layoutSaveDraft";

export interface ActiveLayoutSaveState {
  session: LayoutSession | null;
  hasPending: boolean;
  isSaving: boolean;
  error: Error | null;
  latestRevision: number;
}

export interface ActiveLayoutSaveResult {
  revision: number;
  session: LayoutSession;
  response: LayoutResponse;
}

export type LayoutSaveRecoveryResult =
  | { status: "none" }
  | { status: "recovered"; revision: number }
  | { status: "discarded-foreign" }
  | { status: "discarded-invalid" }
  | { status: "discarded-confirmed" }
  | { status: "deferred-confirmation" };

/**
 * Implementations must honor AbortSignal. The coordinator also rejects at its
 * deadline, but abort support prevents a timed-out request from later writing
 * stale data to the backend.
 */
export type LayoutSaveTransport = (
  layoutId: number,
  furniture: Furniture[],
  roomWidth: number,
  roomDepth: number,
  signal: AbortSignal,
) => Promise<LayoutResponse>;

interface LayoutSaveTask {
  revision: number;
  snapshot: RoomLayout;
}

interface FlushWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
}

interface ActiveLayoutSave {
  session: LayoutSession;
  latestRevision: number;
  activeTask: LayoutSaveTask | null;
  queuedTask: LayoutSaveTask | null;
  error: Error | null;
  flushWaiters: Set<FlushWaiter>;
}

type StateListener = () => void;
type ResultListener = (result: ActiveLayoutSaveResult) => void;

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const INACTIVE_STATE: ActiveLayoutSaveState = {
  session: null,
  hasPending: false,
  isSaving: false,
  error: null,
  latestRevision: 0,
};

export class LayoutSaveCoordinator {
  private active: ActiveLayoutSave | null = null;
  private state: ActiveLayoutSaveState = INACTIVE_STATE;
  private readonly stateListeners = new Set<StateListener>();
  private readonly resultListeners = new Set<ResultListener>();
  private readonly transport: LayoutSaveTransport;
  private readonly draftStore: LayoutSaveDraftStore;
  private readonly requestTimeoutMs: number;
  private readonly isSessionConfirmed: (session: LayoutSession) => boolean;
  private readonly isSessionConfirmPending: (session: LayoutSession) => boolean;
  private readonly isSessionDurablyConfirmed: (session: LayoutSession) => boolean;

  constructor(
    transport: LayoutSaveTransport,
    draftStore: LayoutSaveDraftStore,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    isSessionConfirmed: (session: LayoutSession) => boolean = () => false,
    isSessionConfirmPending: (session: LayoutSession) => boolean = () => false,
    isSessionDurablyConfirmed: (session: LayoutSession) => boolean = isSessionConfirmed,
  ) {
    if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
      throw new Error("Layout save timeout must be a positive number");
    }
    this.transport = transport;
    this.draftStore = draftStore;
    this.requestTimeoutMs = requestTimeoutMs;
    this.isSessionConfirmed = isSessionConfirmed;
    this.isSessionConfirmPending = isSessionConfirmPending;
    this.isSessionDurablyConfirmed = isSessionDurablyConfirmed;
  }

  setActiveSession(session: LayoutSession): void {
    if (this.isSessionConfirmed(session)) {
      throw new Error("Cannot activate a confirmed layout session");
    }

    const current = this.active;
    if (current && hasSameLayoutOwnership(current.session, session)) {
      return;
    }

    if (current && this.hasPending(current)) {
      throw new Error("Cannot replace an active layout session with pending saves");
    }

    current?.flushWaiters.forEach(({ resolve }) => resolve());
    current?.flushWaiters.clear();

    this.active = {
      session: { ...session },
      latestRevision: 0,
      activeTask: null,
      queuedTask: null,
      error: null,
      flushWaiters: new Set<FlushWaiter>(),
    };
    this.publishState();
  }

  enqueue(snapshot: RoomLayout): number {
    const active = this.requireActive();
    if (this.isSessionConfirmed(active.session)) {
      const error = new Error("Cannot save a confirmed layout session");
      active.error = error;
      this.publishState();
      throw error;
    }
    if (this.isSessionConfirmPending(active.session)) {
      const error = new Error("Cannot save while layout confirmation is pending reconciliation");
      active.error = error;
      this.publishState();
      throw error;
    }
    if (snapshot.id !== active.session.ownerUiRoomLayoutId) {
      throw new Error("Layout snapshot belongs to a different UI room");
    }
    assertValidRoomLayout(snapshot);

    const previousRevision = active.latestRevision;
    const previousQueuedTask = active.queuedTask;
    const task: LayoutSaveTask = {
      revision: active.latestRevision + 1,
      snapshot: cloneRoomLayout(snapshot),
    };
    active.latestRevision = task.revision;
    active.queuedTask = task;

    try {
      this.draftStore.save(toPersistedDraft(active.session, task));
    } catch (error) {
      active.latestRevision = previousRevision;
      active.queuedTask = previousQueuedTask;
      active.error = toError(error);
      this.publishState();
      this.settleWaiters(active);
      throw active.error;
    }

    active.error = null;
    this.publishState();
    this.startNext(active);
    return task.revision;
  }

  recover(): LayoutSaveRecoveryResult {
    const active = this.requireActive();
    const readResult = this.draftStore.read();
    if (readResult.status === "none") {
      return { status: "none" };
    }
    if (readResult.status === "discarded-invalid") {
      return { status: "discarded-invalid" };
    }
    if (readResult.status === "storage-error") {
      active.error = readResult.error;
      this.publishState();
      throw readResult.error;
    }

    const { draft } = readResult;
    if (this.isSessionConfirmed(active.session)) {
      if (this.isSessionDurablyConfirmed(active.session)) {
        this.discardDraft(draft);
        return { status: "discarded-confirmed" };
      }
      return { status: "deferred-confirmation" };
    }
    if (this.isSessionConfirmPending(active.session)) {
      return { status: "deferred-confirmation" };
    }
    if (!hasSameLayoutOwnership(draft, active.session)) {
      console.warn("현재 방과 다른 미저장 배치를 폐기했습니다.");
      this.discardDraft(draft);
      return { status: "discarded-foreign" };
    }
    if (active.activeTask || active.queuedTask) {
      return { status: "recovered", revision: active.latestRevision };
    }

    const task: LayoutSaveTask = {
      revision: Math.max(draft.revision, active.latestRevision + 1),
      snapshot: cloneRoomLayout(draft.roomLayout),
    };
    active.latestRevision = task.revision;
    active.queuedTask = task;
    active.error = null;

    if (task.revision !== draft.revision && !this.persistTask(active, task)) {
      return { status: "recovered", revision: task.revision };
    }

    this.publishState();
    this.startNext(active);
    return { status: "recovered", revision: task.revision };
  }

  flush(): Promise<void> {
    const active = this.active;
    if (!active) {
      return Promise.resolve();
    }
    if (active.error && active.queuedTask) {
      this.resume(active);
    }
    return this.waitFor(active);
  }

  getState(): ActiveLayoutSaveState {
    return this.state;
  }

  getPersistedDraft(): PersistedLayoutSaveDraft | null {
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

  subscribeResults(listener: ResultListener): () => void {
    this.resultListeners.add(listener);
    return () => this.resultListeners.delete(listener);
  }

  discardPersistedDraft(expected: PersistedLayoutSaveDraft): boolean {
    const current = this.draftStore.read();
    if (current.status === "storage-error") {
      throw current.error;
    }
    if (
      current.status !== "valid"
      || current.draft.revision !== expected.revision
      || !hasSameLayoutOwnership(current.draft, expected)
    ) {
      return true;
    }
    return this.discardDraft(current.draft);
  }

  clear(): boolean {
    const active = this.active;
    if (active && this.hasPending(active)) {
      throw new Error("Cannot clear an active layout save with pending work");
    }

    active?.flushWaiters.forEach(({ resolve }) => resolve());
    active?.flushWaiters.clear();
    this.active = null;
    this.publishState();

    try {
      this.draftStore.remove();
      return true;
    } catch (error) {
      console.warn("배치 저장 draft를 정리하지 못했습니다.", toError(error));
      return false;
    }
  }

  clearIfOwned(expected: LayoutSession): boolean {
    if (this.isSessionConfirmPending(expected)) {
      throw new Error("Cannot clear a layout with pending confirmation reconciliation");
    }
    const active = this.active;
    if (active && !hasSameLayoutOwnership(active.session, expected)) {
      return false;
    }
    if (active && this.hasPending(active)) {
      throw new Error("Cannot clear an active layout save with pending work");
    }

    const persisted = this.getPersistedDraft();
    if (!active && persisted && !hasSameLayoutOwnership(persisted, expected)) {
      return false;
    }
    active?.flushWaiters.forEach(({ resolve }) => resolve());
    active?.flushWaiters.clear();
    this.active = null;
    this.publishState();
    if (persisted && hasSameLayoutOwnership(persisted, expected)) {
      return this.discardDraft(persisted);
    }
    return true;
  }

  private requireActive(): ActiveLayoutSave {
    if (!this.active) {
      throw new Error("No active layout session");
    }
    return this.active;
  }

  private resume(active: ActiveLayoutSave): void {
    const task = active.queuedTask;
    if (!task || this.active !== active) {
      return;
    }
    if (!this.persistTask(active, task)) {
      return;
    }

    active.error = null;
    this.publishState();
    this.startNext(active);
  }

  private persistTask(active: ActiveLayoutSave, task: LayoutSaveTask): boolean {
    try {
      this.draftStore.save(toPersistedDraft(active.session, task));
      return true;
    } catch (error) {
      active.error = toError(error);
      this.publishState();
      this.settleWaiters(active);
      return false;
    }
  }

  private discardDraft(draft: PersistedLayoutSaveDraft): boolean {
    try {
      this.draftStore.remove(draft.revision);
      return true;
    } catch (error) {
      console.warn("미저장 배치를 폐기하지 못했습니다.", toError(error));
      return false;
    }
  }

  private startNext(active: ActiveLayoutSave): void {
    if (
      this.active !== active
      || active.error
      || active.activeTask
      || !active.queuedTask
    ) {
      return;
    }

    const task = active.queuedTask;
    active.queuedTask = null;
    active.activeTask = task;
    this.publishState();
    void this.runTask(active, task);
  }

  private async runTask(active: ActiveLayoutSave, task: LayoutSaveTask): Promise<void> {
    try {
      const response = await this.executeTransport(active.session, task);
      assertSameFurnitureIds(task.snapshot.furniture, response.recommendedFurniture);

      if (this.active !== active) {
        return;
      }

      active.activeTask = null;
      this.removeDraftAfterSuccess(task.revision);
      this.publishResult({
        revision: task.revision,
        session: { ...active.session },
        response,
      });
      this.publishState();
      this.startNext(active);
      this.settleWaiters(active);
    } catch (error) {
      if (this.active !== active) {
        return;
      }

      active.activeTask = null;
      if (!active.queuedTask || active.queuedTask.revision < task.revision) {
        active.queuedTask = task;
      }
      active.error = toError(error);
      this.publishState();
      this.settleWaiters(active);
    }
  }

  private async executeTransport(
    session: LayoutSession,
    task: LayoutSaveTask,
  ): Promise<LayoutResponse> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Layout save timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);
    });

    try {
      return await Promise.race([
        this.transport(
          session.layoutId,
          task.snapshot.furniture,
          task.snapshot.width,
          task.snapshot.depth,
          controller.signal,
        ),
        timeout,
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private removeDraftAfterSuccess(revision: number): void {
    try {
      this.draftStore.remove(revision);
    } catch (error) {
      console.warn("저장 완료 후 pending marker를 정리하지 못했습니다.", toError(error));
    }
  }

  private waitFor(active: ActiveLayoutSave): Promise<void> {
    if (active.error) {
      return Promise.reject(active.error);
    }
    if (!this.hasPending(active)) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      active.flushWaiters.add({ resolve, reject });
    });
  }

  private settleWaiters(active: ActiveLayoutSave): void {
    if (active.error) {
      active.flushWaiters.forEach(({ reject }) => reject(active.error as Error));
      active.flushWaiters.clear();
      return;
    }
    if (this.hasPending(active)) {
      return;
    }

    active.flushWaiters.forEach(({ resolve }) => resolve());
    active.flushWaiters.clear();
  }

  private hasPending(active: ActiveLayoutSave): boolean {
    return Boolean(active.activeTask || active.queuedTask);
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
    this.stateListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("배치 저장 상태를 화면에 알리지 못했습니다.", error);
      }
    });
  }

  private publishResult(result: ActiveLayoutSaveResult): void {
    this.resultListeners.forEach((listener) => {
      try {
        listener(result);
      } catch (error) {
        console.error("저장 응답을 화면에 반영하지 못했습니다.", error);
      }
    });
  }
}

const defaultCoordinator = new LayoutSaveCoordinator(
  (layoutId, furniture, roomWidth, roomDepth, signal) => (
    updateLayout(layoutId, furniture, roomWidth, roomDepth, signal)
  ),
  new BrowserLayoutSaveDraftStore(),
  DEFAULT_REQUEST_TIMEOUT_MS,
  isLayoutSessionConfirmed,
  isLayoutSessionConfirmPending,
  isLayoutSessionDurablyConfirmed,
);

export function setActiveLayoutSession(session: LayoutSession): void {
  defaultCoordinator.setActiveSession(session);
}

export function enqueueActiveLayoutSave(snapshot: RoomLayout): number {
  assertActiveLayoutEditingAllowed();
  return defaultCoordinator.enqueue(snapshot);
}

export function recoverActiveLayoutSave(): LayoutSaveRecoveryResult {
  return defaultCoordinator.recover();
}

export function flushActiveLayoutSave(): Promise<void> {
  return defaultCoordinator.flush();
}

export function getActiveLayoutSaveState(): ActiveLayoutSaveState {
  return defaultCoordinator.getState();
}

export function getPersistedActiveLayoutDraft(): PersistedLayoutSaveDraft | null {
  return defaultCoordinator.getPersistedDraft();
}

export function discardPersistedActiveLayoutDraft(draft: PersistedLayoutSaveDraft): boolean {
  return defaultCoordinator.discardPersistedDraft(draft);
}

export function subscribeActiveLayoutSaveState(listener: StateListener): () => void {
  return defaultCoordinator.subscribeState(listener);
}

export function subscribeActiveLayoutSaveResults(listener: ResultListener): () => void {
  return defaultCoordinator.subscribeResults(listener);
}

export function clearActiveLayoutSaveState(): boolean {
  return defaultCoordinator.clear();
}

export function clearActiveLayoutSaveStateIfOwned(session: LayoutSession): boolean {
  return defaultCoordinator.clearIfOwned(session);
}

export function useActiveLayoutSaveState(): ActiveLayoutSaveState {
  return useSyncExternalStore(
    subscribeActiveLayoutSaveState,
    getActiveLayoutSaveState,
    getActiveLayoutSaveState,
  );
}

function toPersistedDraft(
  session: LayoutSession,
  task: LayoutSaveTask,
): PersistedLayoutSaveDraft {
  return {
    version: 2,
    layoutId: session.layoutId,
    ownerBackendRoomId: session.ownerBackendRoomId,
    ownerUiRoomLayoutId: session.ownerUiRoomLayoutId,
    revision: task.revision,
    dirty: true,
    updatedAt: new Date().toISOString(),
    roomLayout: task.snapshot,
  };
}

function assertSameFurnitureIds(
  requestFurniture: Furniture[],
  responseFurniture: Array<{ id: string }>,
): void {
  const requestIds = requestFurniture.map((item) => item.id);
  const responseIds = responseFurniture.map((item) => item.id);
  const requestSet = new Set(requestIds);
  const responseSet = new Set(responseIds);
  if (
    requestSet.size !== requestIds.length
    || responseSet.size !== responseIds.length
    || requestSet.size !== responseSet.size
    || requestIds.some((id) => !responseSet.has(id))
  ) {
    throw new Error("Backend layout response furniture IDs do not match the request snapshot");
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Layout save failed");
}
