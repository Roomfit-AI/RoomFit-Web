import { describe, expect, it, vi } from "vitest";

import type { LayoutNavigationState } from "../layoutEditingSession";
import {
  createRecommendationGenerationController,
  getRecommendationGenerationErrorMessage,
  readRecommendationPreparation,
} from "../recommendationGeneration";

const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("recommendation generation preparation", () => {
  it("restores the same room, App client scope, and selected inputs without creating anything", () => {
    const local = memoryStorage({
      "roomfit:backendRoomId": "42",
      "roomfit:selectedRoomId": "api-room-42",
      "roomfit:selectedRoomTitle": "App 스캔 방",
      "roomfit:selectedPurpose": "work",
      "roomfit:selectedPalette": "gray",
      "roomfit:selectedStyle": "modern",
      "roomfit:selectedAdditionalFurnitureIds": '["desk","desk-chair"]',
    });
    const session = preparedSession("api-room-42", 42, "app-setup", "APP_UUID", APP_ID);

    expect(readRecommendationPreparation(local, session)).toEqual({
      ready: true,
      message: "",
      roomId: 42,
      roomLayoutId: "api-room-42",
      roomTitle: "App 스캔 방",
      selectedFurnitureCount: 2,
    });
    expect(JSON.parse(session.getItem("roomfit:activeClientScope:v1") ?? "null").clientId).toBe(APP_ID);
  });

  it("blocks direct entry when room or selection state is missing instead of inventing defaults", () => {
    const preparation = readRecommendationPreparation(memoryStorage(), memoryStorage());
    expect(preparation.ready).toBe(false);
    expect(preparation.message).toContain("방 정보가 없습니다");
  });
});

describe("recommendation generation controller", () => {
  it("does not generate on creation and runs exactly once for concurrent CTA clicks", async () => {
    const deferred = createDeferred<LayoutNavigationState | null>();
    const generate = vi.fn(() => deferred.promise);
    const navigate = vi.fn();
    const running: boolean[] = [];
    const controller = createRecommendationGenerationController({
      generate,
      navigate,
      onRunningChange: (value) => running.push(value),
      onFailure: vi.fn(),
    });

    expect(generate).not.toHaveBeenCalled();
    const first = controller.run();
    const second = controller.run();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(controller.isRunning()).toBe(true);

    deferred.resolve(navigationState(42));
    await Promise.all([first, second]);

    expect(navigate).toHaveBeenCalledExactlyOnceWith("/editor", {
      state: navigationState(42),
      replace: true,
    });
    expect(running).toEqual([true, false]);
    expect(controller.isRunning()).toBe(false);
  });

  it("stays on the page after failure and allows a successful retry", async () => {
    const generate = vi.fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(navigationState(7));
    const navigate = vi.fn();
    const failures: unknown[] = [];
    const controller = createRecommendationGenerationController({
      generate,
      navigate,
      onRunningChange: vi.fn(),
      onFailure: (error) => { if (error) failures.push(error); },
    });

    await controller.run();
    expect(navigate).not.toHaveBeenCalled();
    expect(failures).toHaveLength(1);
    expect(getRecommendationGenerationErrorMessage(failures[0])).not.toContain("network unavailable");

    await controller.run();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/editor", {
      state: navigationState(7),
      replace: true,
    });
  });

  it("ignores a stale completion after the recommendation page unmounts", async () => {
    const deferred = createDeferred<LayoutNavigationState | null>();
    const navigate = vi.fn();
    const running: boolean[] = [];
    const failure = vi.fn();
    const controller = createRecommendationGenerationController({
      generate: () => deferred.promise,
      navigate,
      onRunningChange: (value) => running.push(value),
      onFailure: failure,
    });

    const request = controller.run();
    controller.dispose();
    deferred.resolve(navigationState(9));
    await request;

    expect(navigate).not.toHaveBeenCalled();
    expect(failure).toHaveBeenCalledExactlyOnceWith(null);
    expect(running).toEqual([true]);
    expect(controller.isRunning()).toBe(false);
  });

  it("aborts the generation signal when the recommendation page unmounts", async () => {
    const deferred = createDeferred<LayoutNavigationState | null>();
    let requestSignal: AbortSignal | undefined;
    const controller = createRecommendationGenerationController({
      generate: (signal) => {
        requestSignal = signal;
        return deferred.promise;
      },
      navigate: vi.fn(),
      onRunningChange: vi.fn(),
      onFailure: vi.fn(),
    });

    const request = controller.run();
    expect(requestSignal?.aborted).toBe(false);

    controller.dispose();
    expect(requestSignal?.aborted).toBe(true);
    deferred.resolve(navigationState(9));
    await request;
  });

  it("does not generate merely because a user leaves and re-enters the page", () => {
    const generate = vi.fn();
    const options = {
      generate,
      navigate: vi.fn(),
      onRunningChange: vi.fn(),
      onFailure: vi.fn(),
    };
    createRecommendationGenerationController(options);
    createRecommendationGenerationController(options);
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not let a disposed mount block a fresh controller instance", async () => {
    const generate = vi.fn().mockResolvedValue(navigationState(11));
    const navigate = vi.fn();
    const options = {
      generate,
      navigate,
      onRunningChange: vi.fn(),
      onFailure: vi.fn(),
    };
    const disposedMount = createRecommendationGenerationController(options);
    disposedMount.dispose();
    await disposedMount.run();

    const activeMount = createRecommendationGenerationController(options);
    await activeMount.run();

    expect(generate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/editor", {
      state: navigationState(11),
      replace: true,
    });
  });
});

function navigationState(roomId: number): LayoutNavigationState {
  return {
    roomId,
    roomLayoutId: `api-room-${roomId}`,
    sourceLayoutId: null,
    activeLayoutId: null,
    editingMode: "INITIAL_SETUP",
  };
}

function preparedSession(
  roomLayoutId: string,
  backendRoomId: number,
  sessionId: string,
  mode: "APP_UUID" | "BROWSER_UUID",
  clientId: string,
) {
  return memoryStorage({
    "roomfit:roomSetupSession": JSON.stringify({
      version: 1, sessionId, roomLayoutId, backendRoomId, mode: "NEW", createdAt: "2026-07-19T10:00:00.000Z",
    }),
    "roomfit:activeClientScope:v1": JSON.stringify({
      version: 1, mode, clientId, setupSessionId: sessionId, backendRoomId, roomLayoutId,
    }),
  });
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}
