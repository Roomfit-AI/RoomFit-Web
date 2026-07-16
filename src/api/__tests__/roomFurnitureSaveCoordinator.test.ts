import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RoomFurnitureSaveCoordinator,
  type RoomFurnitureMirrorStore,
  type RoomFurnitureSaveTransport,
} from "../roomFurnitureSaveCoordinator";
import type {
  PersistedRoomFurnitureSaveDraft,
  RoomFurnitureSaveDraftReadResult,
  RoomFurnitureSaveDraftStore,
} from "../roomFurnitureSaveDraft";
import { deferred, makeLayout } from "./layoutTestFixtures";

const ROOM_SESSION = {
  ownerBackendRoomId: 3,
  ownerUiRoomLayoutId: "room-3",
};

describe("RoomFurnitureSaveCoordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("serializes PUTs and sends only the latest queued full snapshot", async () => {
    const firstRequest = deferred<void>();
    const secondRequest = deferred<void>();
    const transport = vi.fn<RoomFurnitureSaveTransport>()
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);
    const mirror = new MemoryRoomMirrorStore();
    const coordinator = new RoomFurnitureSaveCoordinator(transport, new MemoryRoomDraftStore(), mirror);
    coordinator.setActiveSession(ROOM_SESSION);

    coordinator.enqueue(makeLayout(1));
    coordinator.enqueue(makeLayout(2));
    coordinator.enqueue(makeLayout(3));

    expect(transport).toHaveBeenCalledTimes(1);
    expect(mirror.snapshot?.furniture[0].position.x).toBe(3);

    firstRequest.resolve(undefined);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    expect(transport.mock.calls[1][1].furniture[0].position.x).toBe(3);

    secondRequest.resolve(undefined);
    await expect(coordinator.flush()).resolves.toBeUndefined();
    expect(coordinator.getState()).toMatchObject({ hasPending: false, error: null });
  });

  it("keeps the latest snapshot after failure and retries only on explicit flush", async () => {
    const transport = vi.fn<RoomFurnitureSaveTransport>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const coordinator = new RoomFurnitureSaveCoordinator(
      transport,
      new MemoryRoomDraftStore(),
      new MemoryRoomMirrorStore(),
    );
    coordinator.setActiveSession(ROOM_SESSION);
    coordinator.enqueue(makeLayout(4));

    await expect(coordinator.flush()).rejects.toThrow("offline");
    expect(coordinator.getState()).toMatchObject({ hasPending: true });
    expect(transport).toHaveBeenCalledTimes(1);

    await coordinator.retry();
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1][1].furniture[0].position.x).toBe(4);
    expect(coordinator.getState()).toMatchObject({ hasPending: false, error: null });
  });

  it("rejects a different Room owner while failed work is retained", async () => {
    const coordinator = new RoomFurnitureSaveCoordinator(
      () => Promise.reject(new Error("offline")),
      new MemoryRoomDraftStore(),
      new MemoryRoomMirrorStore(),
    );
    coordinator.setActiveSession(ROOM_SESSION);
    coordinator.enqueue(makeLayout());
    await expect(coordinator.flush()).rejects.toThrow("offline");

    expect(() => coordinator.setActiveSession({
      ownerBackendRoomId: 4,
      ownerUiRoomLayoutId: "room-4",
    })).toThrow("pending or failed work");
    expect(coordinator.getState().session).toEqual(ROOM_SESSION);
  });

  it("does not enqueue when preparing the local mirror fails", () => {
    const mirror = new MemoryRoomMirrorStore();
    mirror.error = new Error("quota");
    const transport = vi.fn<RoomFurnitureSaveTransport>().mockResolvedValue(undefined);
    const coordinator = new RoomFurnitureSaveCoordinator(transport, new MemoryRoomDraftStore(), mirror);
    coordinator.setActiveSession(ROOM_SESSION);

    expect(() => coordinator.enqueue(makeLayout())).toThrow("quota");
    expect(coordinator.getState()).toMatchObject({ hasPending: false, latestRevision: 0 });
    expect(transport).not.toHaveBeenCalled();
  });

  it("aborts at the deadline and keeps the snapshot retryable", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const transport = vi.fn<RoomFurnitureSaveTransport>()
      .mockImplementationOnce((_roomId, _snapshot, signal) => {
        signals.push(signal);
        return new Promise<void>(() => undefined);
      })
      .mockResolvedValueOnce(undefined);
    const coordinator = new RoomFurnitureSaveCoordinator(
      transport,
      new MemoryRoomDraftStore(),
      new MemoryRoomMirrorStore(),
      30,
    );
    coordinator.setActiveSession(ROOM_SESSION);
    coordinator.enqueue(makeLayout());

    const firstFlush = coordinator.flush();
    const rejection = expect(firstFlush).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(30);
    await rejection;

    expect(signals[0].aborted).toBe(true);
    expect(coordinator.getState()).toMatchObject({ hasPending: true, isSaving: false });
    expect(vi.getTimerCount()).toBe(0);

    await coordinator.retry();
    expect(coordinator.getState()).toMatchObject({ hasPending: false, error: null });
  });

  it("recovers a dirty full snapshot after reload and clears it only after resend succeeds", async () => {
    const store = new MemoryRoomDraftStore();
    const abandonedRequest = deferred<void>();
    const first = new RoomFurnitureSaveCoordinator(
      () => abandonedRequest.promise,
      store,
      new MemoryRoomMirrorStore(),
    );
    first.setActiveSession(ROOM_SESSION);
    first.enqueue(makeLayout(5));
    expect(store.draft?.snapshot.furniture[0].position.x).toBe(5);

    const resend = vi.fn<RoomFurnitureSaveTransport>().mockResolvedValue(undefined);
    const reloaded = new RoomFurnitureSaveCoordinator(resend, store, new MemoryRoomMirrorStore());
    reloaded.setActiveSession(ROOM_SESSION);
    expect(reloaded.recover()).toMatchObject({ status: "recovered" });
    await reloaded.flush();

    expect(resend).toHaveBeenCalledTimes(1);
    expect(resend.mock.calls[0][1].furniture[0].position.x).toBe(5);
    expect(store.draft).toBeNull();
  });

  it("allows an already-applied full snapshot to be resent idempotently", async () => {
    const store = new MemoryRoomDraftStore();
    let backendSnapshot = makeLayout();
    const responseLostDuringReload = deferred<void>();
    const firstTransport: RoomFurnitureSaveTransport = async (_roomId, snapshot) => {
      backendSnapshot = structuredClone(snapshot);
      return responseLostDuringReload.promise;
    };
    const first = new RoomFurnitureSaveCoordinator(firstTransport, store, new MemoryRoomMirrorStore());
    first.setActiveSession(ROOM_SESSION);
    first.enqueue(makeLayout(6));
    await vi.waitFor(() => expect(backendSnapshot.furniture[0].position.x).toBe(6));

    const resendTransport: RoomFurnitureSaveTransport = async (_roomId, snapshot) => {
      backendSnapshot = structuredClone(snapshot);
    };
    const reloaded = new RoomFurnitureSaveCoordinator(resendTransport, store, new MemoryRoomMirrorStore());
    reloaded.setActiveSession(ROOM_SESSION);
    reloaded.recover();
    await reloaded.flush();
    expect(backendSnapshot).toEqual(makeLayout(6));
  });

  it("does not remove a newer draft when an older request succeeds", async () => {
    const store = new MemoryRoomDraftStore();
    const firstRequest = deferred<void>();
    const secondRequest = deferred<void>();
    const coordinator = new RoomFurnitureSaveCoordinator(
      vi.fn<RoomFurnitureSaveTransport>()
        .mockImplementationOnce(() => firstRequest.promise)
        .mockImplementationOnce(() => secondRequest.promise),
      store,
      new MemoryRoomMirrorStore(),
    );
    coordinator.setActiveSession(ROOM_SESSION);
    coordinator.enqueue(makeLayout(1));
    coordinator.enqueue(makeLayout(7));
    firstRequest.resolve(undefined);
    await vi.waitFor(() => expect(coordinator.getState().isSaving).toBe(true));
    expect(store.draft?.snapshot.furniture[0].position.x).toBe(7);

    const resend = vi.fn<RoomFurnitureSaveTransport>().mockResolvedValue(undefined);
    const reloaded = new RoomFurnitureSaveCoordinator(resend, store, new MemoryRoomMirrorStore());
    reloaded.setActiveSession(ROOM_SESSION);
    reloaded.recover();
    await reloaded.flush();
    expect(resend.mock.calls[0][1].furniture[0].position.x).toBe(7);
  });

  it("keeps a failed dirty draft recoverable by a new coordinator", async () => {
    const store = new MemoryRoomDraftStore();
    const failed = new RoomFurnitureSaveCoordinator(
      () => Promise.reject(new Error("offline")),
      store,
      new MemoryRoomMirrorStore(),
    );
    failed.setActiveSession(ROOM_SESSION);
    failed.enqueue(makeLayout(8));
    await expect(failed.flush()).rejects.toThrow("offline");

    const transport = vi.fn<RoomFurnitureSaveTransport>().mockResolvedValue(undefined);
    const reloaded = new RoomFurnitureSaveCoordinator(transport, store, new MemoryRoomMirrorStore());
    reloaded.setActiveSession(ROOM_SESSION);
    reloaded.recover();
    await reloaded.flush();
    expect(transport.mock.calls[0][1].furniture[0].position.x).toBe(8);
  });

  it("discards a foreign Room draft once without sending it", () => {
    const store = new MemoryRoomDraftStore();
    store.draft = makeRoomDraft({ ownerBackendRoomId: 9, ownerUiRoomLayoutId: "room-9" }, makeLayout());
    const transport = vi.fn<RoomFurnitureSaveTransport>();
    const coordinator = new RoomFurnitureSaveCoordinator(transport, store, new MemoryRoomMirrorStore());
    coordinator.setActiveSession(ROOM_SESSION);

    expect(coordinator.recover()).toEqual({ status: "discarded-foreign" });
    expect(coordinator.recover()).toEqual({ status: "none" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not enqueue or update the mirror when draft persistence fails", () => {
    const store = new MemoryRoomDraftStore();
    store.saveError = new Error("quota");
    const mirror = new MemoryRoomMirrorStore();
    const transport = vi.fn<RoomFurnitureSaveTransport>();
    const coordinator = new RoomFurnitureSaveCoordinator(transport, store, mirror);
    coordinator.setActiveSession(ROOM_SESSION);

    expect(() => coordinator.enqueue(makeLayout(9))).toThrow("quota");
    expect(mirror.snapshot).toBeNull();
    expect(transport).not.toHaveBeenCalled();
    expect(coordinator.getState()).toMatchObject({ hasPending: false, latestRevision: 0 });
  });

  it("preserves another active Room while discarding only the deleted owner's draft", () => {
    const store = new MemoryRoomDraftStore();
    const deletedOwner = { ownerBackendRoomId: 4, ownerUiRoomLayoutId: "room-4" };
    store.draft = makeRoomDraft(deletedOwner, makeLayout());
    const coordinator = new RoomFurnitureSaveCoordinator(
      () => Promise.resolve(undefined),
      store,
      new MemoryRoomMirrorStore(),
    );
    coordinator.setActiveSession(ROOM_SESSION);

    expect(coordinator.clearIfOwned(deletedOwner)).toBe(false);
    expect(coordinator.getState().session).toEqual(ROOM_SESSION);
    expect(coordinator.discardPersistedDraftIfOwned(deletedOwner)).toBe(true);
    expect(store.draft).toBeNull();
    expect(coordinator.getState().session).toEqual(ROOM_SESSION);
  });
});

class MemoryRoomMirrorStore implements RoomFurnitureMirrorStore {
  snapshot: ReturnType<typeof makeLayout> | null = null;
  error: Error | null = null;

  save(snapshot: ReturnType<typeof makeLayout>): void {
    if (this.error) {
      throw this.error;
    }
    this.snapshot = structuredClone(snapshot);
  }
}

class MemoryRoomDraftStore implements RoomFurnitureSaveDraftStore {
  draft: PersistedRoomFurnitureSaveDraft | null = null;
  saveError: Error | null = null;

  read(): RoomFurnitureSaveDraftReadResult {
    return this.draft
      ? { status: "valid", draft: structuredClone(this.draft) }
      : { status: "none" };
  }

  save(draft: PersistedRoomFurnitureSaveDraft): void {
    if (this.saveError) {
      throw this.saveError;
    }
    this.draft = structuredClone(draft);
  }

  remove(expectedRevision?: number): void {
    if (expectedRevision !== undefined && this.draft?.revision !== expectedRevision) {
      return;
    }
    this.draft = null;
  }
}

function makeRoomDraft(
  owner: typeof ROOM_SESSION,
  snapshot: ReturnType<typeof makeLayout>,
): PersistedRoomFurnitureSaveDraft {
  return {
    version: 1,
    ...owner,
    revision: 1,
    dirty: true,
    updatedAt: "2026-07-17T00:00:00.000Z",
    snapshot: { ...snapshot, id: owner.ownerUiRoomLayoutId },
  };
}
