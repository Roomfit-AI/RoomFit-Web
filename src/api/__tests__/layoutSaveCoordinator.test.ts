import { afterEach, describe, expect, it, vi } from "vitest";

import { LayoutSaveCoordinator, type LayoutSaveTransport } from "../layoutSaveCoordinator";
import type { PersistedLayoutSaveDraft } from "../layoutSaveDraft";
import {
  TEST_SESSION,
  MemoryDraftStore,
  deferred,
  flushMicrotasks,
  makeLayout,
  makeLayoutResponse,
} from "./layoutTestFixtures";

describe("LayoutSaveCoordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("serializes one request and coalesces queued edits to the latest snapshot", async () => {
    const store = new MemoryDraftStore();
    const requests = [deferred<ReturnType<typeof makeLayoutResponse>>(), deferred<ReturnType<typeof makeLayoutResponse>>()];
    const sentPositions: number[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    const transport: LayoutSaveTransport = vi.fn(async (_layoutId, furniture) => {
      const requestIndex = sentPositions.length;
      sentPositions.push(furniture[0].position.x);
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      try {
        return await requests[requestIndex].promise;
      } finally {
        concurrent -= 1;
      }
    });
    const coordinator = new LayoutSaveCoordinator(transport, store);
    coordinator.setActiveSession(TEST_SESSION);

    coordinator.enqueue(makeLayout(0));
    coordinator.enqueue(makeLayout(1));
    coordinator.enqueue(makeLayout(2));
    expect(transport).toHaveBeenCalledTimes(1);
    expect(store.draft?.roomLayout.furniture[0].position.x).toBe(2);

    const flushed = coordinator.flush();
    requests[0].resolve(makeLayoutResponse());
    await flushMicrotasks();
    expect(transport).toHaveBeenCalledTimes(2);
    expect(sentPositions).toEqual([0, 2]);

    requests[1].resolve(makeLayoutResponse());
    await flushed;
    expect(maxConcurrent).toBe(1);
    expect(coordinator.getState()).toMatchObject({ hasPending: false, error: null, latestRevision: 3 });
    expect(store.draft).toBeNull();
  });

  it("keeps the latest snapshot after failure and retries it on the next flush", async () => {
    const store = new MemoryDraftStore();
    const transport = vi.fn<LayoutSaveTransport>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(makeLayoutResponse());
    const coordinator = new LayoutSaveCoordinator(transport, store);
    coordinator.setActiveSession(TEST_SESSION);
    coordinator.enqueue(makeLayout(1));

    await expect(coordinator.flush()).rejects.toThrow("offline");
    expect(coordinator.getState()).toMatchObject({ hasPending: true });
    expect(coordinator.getState().error?.message).toBe("offline");
    expect(store.draft?.roomLayout.furniture[0].position.x).toBe(1);

    await coordinator.flush();
    expect(transport).toHaveBeenCalledTimes(2);
    expect(coordinator.getState()).toMatchObject({ hasPending: false, error: null });
    expect(store.draft).toBeNull();
  });

  it("aborts at the deadline, releases the active task, and remains retryable", async () => {
    vi.useFakeTimers();
    const store = new MemoryDraftStore();
    const signals: AbortSignal[] = [];
    let attempt = 0;
    const transport: LayoutSaveTransport = vi.fn((_layoutId, _furniture, _width, _depth, signal) => {
      attempt += 1;
      if (attempt === 1) {
        signals.push(signal);
        return new Promise<ReturnType<typeof makeLayoutResponse>>(() => undefined);
      }
      return Promise.resolve(makeLayoutResponse());
    });
    const coordinator = new LayoutSaveCoordinator(transport, store, 30);
    coordinator.setActiveSession(TEST_SESSION);
    coordinator.enqueue(makeLayout());

    const firstFlush = coordinator.flush();
    const timeoutRejection = expect(firstFlush).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(30);
    await timeoutRejection;
    expect(signals[0].aborted).toBe(true);
    expect(coordinator.getState()).toMatchObject({ hasPending: true, isSaving: false });
    expect(vi.getTimerCount()).toBe(0);

    await coordinator.flush();
    expect(transport).toHaveBeenCalledTimes(2);
    expect(coordinator.getState()).toMatchObject({ hasPending: false, error: null });
  });

  it("settles every flush waiter on both success and failure", async () => {
    const successRequest = deferred<ReturnType<typeof makeLayoutResponse>>();
    const successCoordinator = new LayoutSaveCoordinator(
      () => successRequest.promise,
      new MemoryDraftStore(),
    );
    successCoordinator.setActiveSession(TEST_SESSION);
    successCoordinator.enqueue(makeLayout());
    const successWaiters = [successCoordinator.flush(), successCoordinator.flush()];
    successRequest.resolve(makeLayoutResponse());
    await expect(Promise.all(successWaiters)).resolves.toEqual([undefined, undefined]);

    const failureRequest = deferred<ReturnType<typeof makeLayoutResponse>>();
    const failureCoordinator = new LayoutSaveCoordinator(
      () => failureRequest.promise,
      new MemoryDraftStore(),
    );
    failureCoordinator.setActiveSession(TEST_SESSION);
    failureCoordinator.enqueue(makeLayout());
    const failureWaiters = [failureCoordinator.flush(), failureCoordinator.flush()];
    failureRequest.reject(new Error("failed"));
    const settled = await Promise.allSettled(failureWaiters);
    expect(settled.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(failureCoordinator.getState().hasPending).toBe(true);
  });

  it("throws before UI application when draft persistence fails", async () => {
    const store = new MemoryDraftStore();
    store.saveError = new Error("quota");
    const transport = vi.fn<LayoutSaveTransport>().mockResolvedValue(makeLayoutResponse());
    const coordinator = new LayoutSaveCoordinator(transport, store);
    coordinator.setActiveSession(TEST_SESSION);

    expect(() => coordinator.enqueue(makeLayout(3))).toThrow("quota");
    expect(coordinator.getState()).toMatchObject({ hasPending: false });
    expect(coordinator.getState().error?.message).toBe("quota");
    expect(transport).not.toHaveBeenCalled();

    store.saveError = null;
    coordinator.enqueue(makeLayout(3));
    await coordinator.flush();
    expect(coordinator.getState()).toMatchObject({ hasPending: false, error: null });
  });

  it("discards a foreign draft once without sending it and recovers a matching draft", async () => {
    const store = new MemoryDraftStore();
    store.draft = makeDraft({
      ...TEST_SESSION,
      layoutId: 99,
      ownerBackendRoomId: 44,
      ownerUiRoomLayoutId: "room-44",
    });
    const transport = vi.fn<LayoutSaveTransport>().mockResolvedValue(makeLayoutResponse());
    const coordinator = new LayoutSaveCoordinator(transport, store);
    coordinator.setActiveSession(TEST_SESSION);

    expect(coordinator.recover()).toEqual({ status: "discarded-foreign" });
    expect(coordinator.recover()).toEqual({ status: "none" });
    expect(transport).not.toHaveBeenCalled();

    store.draft = makeDraft(TEST_SESSION);
    expect(coordinator.recover()).toMatchObject({ status: "recovered" });
    await coordinator.flush();
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("reports and clears an invalid draft without blocking later recovery", () => {
    const store = new MemoryDraftStore();
    store.invalid = true;
    const coordinator = new LayoutSaveCoordinator(
      () => Promise.resolve(makeLayoutResponse()),
      store,
    );
    coordinator.setActiveSession(TEST_SESSION);

    expect(coordinator.recover()).toEqual({ status: "discarded-invalid" });
    expect(coordinator.recover()).toEqual({ status: "none" });
    expect(coordinator.getState()).toMatchObject({ hasPending: false, error: null });
  });

  it("preserves another active Layout while discarding only the deleted owner's draft", () => {
    const store = new MemoryDraftStore();
    const deletedSession = { ...TEST_SESSION, layoutId: 99, ownerBackendRoomId: 4, ownerUiRoomLayoutId: "room-4" };
    store.draft = makeDraft(deletedSession);
    const coordinator = new LayoutSaveCoordinator(
      () => Promise.resolve(makeLayoutResponse()),
      store,
    );
    coordinator.setActiveSession(TEST_SESSION);

    expect(coordinator.clearIfOwned(deletedSession)).toBe(false);
    expect(coordinator.getState().session).toEqual(TEST_SESSION);
    expect(coordinator.discardPersistedDraft(store.draft as PersistedLayoutSaveDraft)).toBe(true);
    expect(store.draft).toBeNull();
    expect(coordinator.getState().session).toEqual(TEST_SESSION);
  });

  it("defers stale draft recovery while matching confirmation is pending", () => {
    const store = new MemoryDraftStore();
    store.draft = makeDraft(TEST_SESSION);
    const transport = vi.fn<LayoutSaveTransport>();
    const coordinator = new LayoutSaveCoordinator(
      transport,
      store,
      30_000,
      () => false,
      () => true,
    );
    coordinator.setActiveSession(TEST_SESSION);

    expect(coordinator.recover()).toEqual({ status: "deferred-confirmation" });
    expect(transport).not.toHaveBeenCalled();
    expect(store.draft).not.toBeNull();
  });

  it.each([
    ["missing", ["desk-1"]],
    ["additional", ["desk-1", "chair-1", "lamp-1"]],
    ["duplicate", ["desk-1", "desk-1"]],
  ])("rejects a %s response ID set and preserves the request snapshot", async (_label, responseIds) => {
    const store = new MemoryDraftStore();
    const coordinator = new LayoutSaveCoordinator(
      () => Promise.resolve(makeLayoutResponse(responseIds)),
      store,
    );
    coordinator.setActiveSession(TEST_SESSION);
    coordinator.enqueue(makeLayout(4));

    await expect(coordinator.flush()).rejects.toThrow("furniture IDs do not match");
    expect(coordinator.getState()).toMatchObject({ hasPending: true });
    expect(store.draft?.roomLayout.furniture[0].position.x).toBe(4);
  });

  it("isolates subscriber exceptions from the worker and other subscribers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = new MemoryDraftStore();
    const coordinator = new LayoutSaveCoordinator(
      () => Promise.resolve(makeLayoutResponse()),
      store,
    );
    const stateListener = vi.fn();
    const resultListener = vi.fn();
    coordinator.subscribeState(() => {
      throw new Error("state listener");
    });
    coordinator.subscribeState(stateListener);
    coordinator.subscribeResults(() => {
      throw new Error("result listener");
    });
    coordinator.subscribeResults(resultListener);

    coordinator.setActiveSession(TEST_SESSION);
    coordinator.enqueue(makeLayout());
    await coordinator.flush();
    expect(stateListener).toHaveBeenCalled();
    expect(resultListener).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().hasPending).toBe(false);
  });

  it("discards a stale draft after the active session becomes confirmed", () => {
    const store = new MemoryDraftStore();
    store.draft = makeDraft(TEST_SESSION);
    let confirmed = false;
    const coordinator = new LayoutSaveCoordinator(
      () => Promise.resolve(makeLayoutResponse()),
      store,
      30_000,
      () => confirmed,
    );
    coordinator.setActiveSession(TEST_SESSION);
    confirmed = true;

    expect(coordinator.recover()).toEqual({ status: "discarded-confirmed" });
    expect(store.draft).toBeNull();
  });
});

function makeDraft(session: typeof TEST_SESSION): PersistedLayoutSaveDraft {
  const layout = makeLayout();
  layout.id = session.ownerUiRoomLayoutId;
  return {
    ...session,
    version: 2,
    revision: 1,
    dirty: true,
    updatedAt: "2026-07-16T00:00:00.000Z",
    roomLayout: layout,
  };
}
