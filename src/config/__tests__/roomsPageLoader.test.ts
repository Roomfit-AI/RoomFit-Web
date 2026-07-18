import { describe, expect, it, vi } from "vitest";

import { createRoomsPageLoader } from "../roomsPageLoader";

describe("Rooms page request loader", () => {
  it("coalesces StrictMode remounts while keeping samples and recent parallel", async () => {
    const samples = deferred<never[]>();
    const recent = deferred<never[]>();
    const getSamples = vi.fn(() => samples.promise);
    const getRecent = vi.fn(() => recent.promise);
    const loader = createRoomsPageLoader({ getSamples, getRecent });

    const sampleA = loader.loadSamples();
    const sampleB = loader.loadSamples();
    const recentA = loader.loadRecent();
    const recentB = loader.loadRecent();

    expect(getSamples).toHaveBeenCalledTimes(1);
    expect(getRecent).toHaveBeenCalledTimes(1);
    expect(sampleA).toBe(sampleB);
    expect(recentA).toBe(recentB);

    samples.resolve([]);
    recent.resolve([]);
    await Promise.all([sampleA, recentA]);
  });

  it("does not auto-retry failures and permits one later explicit load", async () => {
    const getSamples = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    const loader = createRoomsPageLoader({
      getSamples,
      getRecent: vi.fn().mockResolvedValue([]),
    });

    await expect(loader.loadSamples()).rejects.toThrow("offline");
    expect(getSamples).toHaveBeenCalledTimes(1);

    await expect(loader.loadSamples()).resolves.toEqual([]);
    expect(getSamples).toHaveBeenCalledTimes(2);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
