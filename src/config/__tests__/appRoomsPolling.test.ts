import { afterEach, describe, expect, it, vi } from "vitest";

import type { UploadedRoomCard } from "../../api/rooms";
import {
  APP_ROOMS_POLL_INTERVAL_MS,
  startAppRoomsPolling,
} from "../appRoomsPolling";

const APP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("paired App room polling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads immediately and repeats only the App request after five seconds", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibilitySource("visible");
    const loadRooms = vi.fn().mockResolvedValue([room(1)]);
    const loadSamples = vi.fn();
    const loadBrowserRooms = vi.fn();
    const polling = startAppRoomsPolling({
      clientId: APP_A,
      loadRooms,
      onSuccess: vi.fn(),
      onError: vi.fn(),
      visibilitySource: visibility,
    });

    await flushPromises();
    expect(loadRooms).toHaveBeenCalledTimes(1);
    expect(loadRooms.mock.calls[0][0]).toBe(APP_A);

    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS);
    expect(loadRooms).toHaveBeenCalledTimes(2);
    expect(loadSamples).not.toHaveBeenCalled();
    expect(loadBrowserRooms).not.toHaveBeenCalled();
    polling.stop();
  });

  it("does not request or install lifecycle work without a paired App", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibilitySource("visible");
    const loadRooms = vi.fn().mockResolvedValue([]);
    const polling = startAppRoomsPolling({
      clientId: null,
      loadRooms,
      onSuccess: vi.fn(),
      onError: vi.fn(),
      visibilitySource: visibility,
    });

    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS * 2);
    expect(loadRooms).not.toHaveBeenCalled();
    expect(visibility.listenerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    polling.stop();
  });

  it("stops scheduled App requests immediately after unlink", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibilitySource("visible");
    const loadRooms = vi.fn().mockResolvedValue([]);
    const polling = startAppRoomsPolling({
      clientId: APP_A,
      loadRooms,
      onSuccess: vi.fn(),
      onError: vi.fn(),
      visibilitySource: visibility,
    });

    await flushPromises();
    expect(loadRooms).toHaveBeenCalledTimes(1);
    polling.stop();
    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS * 2);
    expect(loadRooms).toHaveBeenCalledTimes(1);
    expect(visibility.listenerCount).toBe(0);
  });

  it("never overlaps an in-flight request", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibilitySource("visible");
    const pending = deferred<UploadedRoomCard[]>();
    const loadRooms = vi.fn(() => pending.promise);
    const polling = startAppRoomsPolling({
      clientId: APP_A,
      loadRooms,
      onSuccess: vi.fn(),
      onError: vi.fn(),
      visibilitySource: visibility,
    });

    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS * 3);
    visibility.dispatch("visible");
    expect(loadRooms).toHaveBeenCalledTimes(1);

    pending.resolve([room(1)]);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS);
    expect(loadRooms).toHaveBeenCalledTimes(2);
    polling.stop();
  });

  it("adds a newly uploaded App room without touching other section or selection state", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibilitySource("visible");
    const initialRooms = [room(1)];
    const refreshedRooms = [room(2), room(1)];
    const loadRooms = vi.fn()
      .mockResolvedValueOnce(initialRooms)
      .mockResolvedValueOnce(refreshedRooms);
    let appRooms: UploadedRoomCard[] = [];
    const publicRooms = ["public-room"];
    const browserRooms = ["browser-room"];
    const selectedKey = "browser:15";
    const polling = startAppRoomsPolling({
      clientId: APP_A,
      loadRooms,
      onSuccess: (rooms) => { appRooms = rooms; },
      onError: vi.fn(),
      visibilitySource: visibility,
    });

    await flushPromises();
    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS);
    expect(appRooms.map(({ roomId }) => roomId)).toEqual([2, 1]);
    expect(publicRooms).toEqual(["public-room"]);
    expect(browserRooms).toEqual(["browser-room"]);
    expect(selectedKey).toBe("browser:15");
    polling.stop();
  });

  it("pauses while hidden and refreshes immediately when visible again", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibilitySource("hidden");
    const loadRooms = vi.fn().mockResolvedValue([]);
    const polling = startAppRoomsPolling({
      clientId: APP_A,
      loadRooms,
      onSuccess: vi.fn(),
      onError: vi.fn(),
      visibilitySource: visibility,
    });

    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS * 2);
    expect(loadRooms).not.toHaveBeenCalled();

    visibility.dispatch("visible");
    await flushPromises();
    expect(loadRooms).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS);
    expect(loadRooms).toHaveBeenCalledTimes(2);

    visibility.dispatch("hidden");
    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS * 2);
    expect(loadRooms).toHaveBeenCalledTimes(2);

    visibility.dispatch("visible");
    await flushPromises();
    expect(loadRooms).toHaveBeenCalledTimes(3);
    polling.stop();
  });

  it("aborts and removes timers and listeners when stopped", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibilitySource("visible");
    const pending = deferred<UploadedRoomCard[]>();
    let requestSignal: AbortSignal | undefined;
    const onSuccess = vi.fn();
    const polling = startAppRoomsPolling({
      clientId: APP_A,
      loadRooms: vi.fn((_clientId, signal) => {
        requestSignal = signal;
        return pending.promise;
      }),
      onSuccess,
      onError: vi.fn(),
      visibilitySource: visibility,
    });

    polling.stop();
    expect(requestSignal?.aborted).toBe(true);
    expect(visibility.listenerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    pending.resolve([room(1)]);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS * 2);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("prevents an old App response from overwriting a new App state", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibilitySource("visible");
    const oldRequest = deferred<UploadedRoomCard[]>();
    const applied: number[][] = [];
    const oldPolling = startAppRoomsPolling({
      clientId: APP_A,
      loadRooms: vi.fn(() => oldRequest.promise),
      onSuccess: (rooms) => applied.push(rooms.map(({ roomId }) => roomId)),
      onError: vi.fn(),
      visibilitySource: visibility,
    });

    oldPolling.stop();
    const newPolling = startAppRoomsPolling({
      clientId: APP_B,
      loadRooms: vi.fn().mockResolvedValue([room(2)]),
      onSuccess: (rooms) => applied.push(rooms.map(({ roomId }) => roomId)),
      onError: vi.fn(),
      visibilitySource: visibility,
    });
    await flushPromises();

    oldRequest.resolve([room(1)]);
    await flushPromises();
    expect(applied).toEqual([[2]]);
    newPolling.stop();
  });

  it("retains cards after a polling failure and recovers on the next cycle without loading flicker", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibilitySource("visible");
    const loadRooms = vi.fn()
      .mockResolvedValueOnce([room(1)])
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([room(2), room(1)]);
    let appRooms: UploadedRoomCard[] = [];
    let appError = false;
    let loading = true;
    const requestKinds: boolean[] = [];
    const polling = startAppRoomsPolling({
      clientId: APP_A,
      loadRooms,
      onSuccess: (rooms, { initial }) => {
        requestKinds.push(initial);
        appRooms = rooms;
        appError = false;
        loading = false;
      },
      onError: (_error, { initial }) => {
        requestKinds.push(initial);
        appError = true;
        if (initial) loading = false;
      },
      visibilitySource: visibility,
    });

    await flushPromises();
    expect(appRooms.map(({ roomId }) => roomId)).toEqual([1]);
    expect(loading).toBe(false);

    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS);
    expect(appError).toBe(true);
    expect(appRooms.map(({ roomId }) => roomId)).toEqual([1]);
    expect(loading).toBe(false);

    await vi.advanceTimersByTimeAsync(APP_ROOMS_POLL_INTERVAL_MS);
    expect(appError).toBe(false);
    expect(appRooms.map(({ roomId }) => roomId)).toEqual([2, 1]);
    expect(requestKinds).toEqual([true, false, false]);
    polling.stop();
  });
});

class FakeVisibilitySource {
  private readonly listeners = new Set<EventListener>();
  visibilityState: DocumentVisibilityState;

  constructor(visibilityState: DocumentVisibilityState) {
    this.visibilityState = visibilityState;
  }

  get listenerCount() {
    return this.listeners.size;
  }

  addEventListener(_type: "visibilitychange", listener: EventListener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "visibilitychange", listener: EventListener) {
    this.listeners.delete(listener);
  }

  dispatch(state: DocumentVisibilityState) {
    this.visibilityState = state;
    const event = { type: "visibilitychange" } as Event;
    this.listeners.forEach((listener) => listener(event));
  }
}

function room(roomId: number): UploadedRoomCard {
  return { roomId, title: `Room ${roomId}` } as UploadedRoomCard;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
