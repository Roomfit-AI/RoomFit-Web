import { describe, expect, it } from "vitest";

import {
  ALREADY_CONFIRMED_ERROR_CODE,
  ALREADY_CONFIRMED_HTTP_STATUS,
  beginLayoutConfirmAttempt,
  cleanupConfirmedLayoutLocally,
  isLayoutSessionConfirmed,
  markLayoutConfirmAttemptConfirmed,
  parseLayoutConfirmAttempt,
  shouldReconcileAlreadyConfirmed,
  type LayoutConfirmAttempt,
  type LayoutConfirmAttemptStore,
} from "../layoutConfirmation";
import { hasSameLayoutOwnership, type LayoutSession } from "../layoutSession";
import { TEST_SESSION } from "./layoutTestFixtures";

describe("layout confirmation state", () => {
  it("records a required pending marker before confirming and marks success", () => {
    const store = new MemoryConfirmStore();
    const pending = beginLayoutConfirmAttempt(TEST_SESSION, store, new Date("2026-07-16T00:00:00.000Z"));
    expect(pending).toMatchObject({ status: "pending", ...TEST_SESSION });

    const result = markLayoutConfirmAttemptConfirmed(TEST_SESSION, store);
    expect(result).toMatchObject({ persisted: true, attempt: { status: "confirmed" } });
    expect(isLayoutSessionConfirmed(TEST_SESSION, store)).toBe(true);
  });

  it("does not start confirm when the pending marker cannot be persisted", () => {
    const store = new MemoryConfirmStore();
    store.writeError = new Error("storage unavailable");
    expect(() => beginLayoutConfirmAttempt(TEST_SESSION, store)).toThrow("storage unavailable");
    expect(store.read()).toBeNull();
  });

  it("reconciles only an exact 409 ALREADY_CONFIRMED for the matching owner", () => {
    const store = new MemoryConfirmStore();
    const attempt = beginLayoutConfirmAttempt(TEST_SESSION, store);
    const exactError = {
      httpStatus: ALREADY_CONFIRMED_HTTP_STATUS,
      code: ALREADY_CONFIRMED_ERROR_CODE,
    };

    expect(shouldReconcileAlreadyConfirmed(TEST_SESSION, attempt, exactError)).toBe(true);
    expect(shouldReconcileAlreadyConfirmed(
      { ...TEST_SESSION, layoutId: 99 },
      attempt,
      exactError,
    )).toBe(false);
    expect(shouldReconcileAlreadyConfirmed(TEST_SESSION, attempt, {
      httpStatus: 409,
      code: "LAYOUT_NOT_FOUND",
    })).toBe(false);
    expect(shouldReconcileAlreadyConfirmed(TEST_SESSION, attempt, {
      httpStatus: 500,
      code: ALREADY_CONFIRMED_ERROR_CODE,
    })).toBe(false);
  });

  it("keeps a confirmed marker when cleanup fails without changing confirmation success", () => {
    const store = new MemoryConfirmStore();
    beginLayoutConfirmAttempt(TEST_SESSION, store);
    markLayoutConfirmAttemptConfirmed(TEST_SESSION, store);

    const cleanup = cleanupConfirmedLayoutLocally(TEST_SESSION, {
      clearCoordinator: () => false,
      clearSession: () => undefined,
    }, store);

    expect(cleanup).toEqual({ complete: false, warnings: ["draft"] });
    expect(isLayoutSessionConfirmed(TEST_SESSION, store)).toBe(true);
  });

  it("keeps the marker when session cleanup throws", () => {
    const store = new MemoryConfirmStore();
    beginLayoutConfirmAttempt(TEST_SESSION, store);
    markLayoutConfirmAttemptConfirmed(TEST_SESSION, store);

    const cleanup = cleanupConfirmedLayoutLocally(TEST_SESSION, {
      clearCoordinator: () => true,
      clearSession: () => {
        throw new Error("storage unavailable");
      },
    }, store);

    expect(cleanup).toEqual({ complete: false, warnings: ["session"] });
    expect(isLayoutSessionConfirmed(TEST_SESSION, store)).toBe(true);
  });

  it("removes the marker only after coordinator and session cleanup both succeed", () => {
    const store = new MemoryConfirmStore();
    beginLayoutConfirmAttempt(TEST_SESSION, store);
    markLayoutConfirmAttemptConfirmed(TEST_SESSION, store);

    expect(cleanupConfirmedLayoutLocally(TEST_SESSION, {
      clearCoordinator: () => true,
      clearSession: () => undefined,
    }, store)).toEqual({ complete: true, warnings: [] });
    expect(store.read()).toBeNull();
  });

  it("rejects malformed persisted markers", () => {
    const valid: LayoutConfirmAttempt = {
      ...TEST_SESSION,
      version: 1,
      attemptedAt: "2026-07-16T00:00:00.000Z",
      status: "pending",
    };
    expect(parseLayoutConfirmAttempt(JSON.stringify(valid))).toEqual(valid);
    expect(parseLayoutConfirmAttempt(JSON.stringify({ ...valid, attemptedAt: "today" }))).toBeNull();
    expect(parseLayoutConfirmAttempt(JSON.stringify({ ...valid, ownerBackendRoomId: "3" }))).toBeNull();
    expect(parseLayoutConfirmAttempt("not-json")).toBeNull();
  });
});

class MemoryConfirmStore implements LayoutConfirmAttemptStore {
  private attempt: LayoutConfirmAttempt | null = null;
  writeError: Error | null = null;
  removeResult = true;

  read(): LayoutConfirmAttempt | null {
    return this.attempt ? { ...this.attempt } : null;
  }

  write(attempt: LayoutConfirmAttempt): void {
    if (this.writeError) {
      throw this.writeError;
    }
    this.attempt = { ...attempt };
  }

  remember(attempt: LayoutConfirmAttempt): void {
    this.attempt = { ...attempt };
  }

  remove(expected?: LayoutSession): boolean {
    if (expected && this.attempt && !hasSameLayoutOwnership(expected, this.attempt)) {
      return true;
    }
    if (!this.removeResult) {
      return false;
    }
    this.attempt = null;
    return true;
  }
}
