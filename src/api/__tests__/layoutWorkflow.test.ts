import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ActiveLayoutWorkflowCoordinator,
  assertActiveLayoutEditingAllowed,
  beginActiveLayoutWorkflow,
  endActiveLayoutWorkflow,
} from "../layoutWorkflow";
import { TEST_SESSION } from "./layoutTestFixtures";

describe("ActiveLayoutWorkflowCoordinator", () => {
  let globalToken: ReturnType<typeof beginActiveLayoutWorkflow> | null = null;

  afterEach(() => {
    if (globalToken) {
      endActiveLayoutWorkflow(globalToken);
      globalToken = null;
    }
    vi.restoreAllMocks();
  });

  it("blocks editing and conflicting workflows while feedback is active", () => {
    const coordinator = new ActiveLayoutWorkflowCoordinator();
    const token = coordinator.begin("feedback", TEST_SESSION);

    expect(coordinator.getState()).toMatchObject({ kind: "feedback", revision: token.revision });
    expect(() => coordinator.assertEditingAllowed()).toThrow("locked by feedback");
    expect(() => coordinator.begin("room-transition", TEST_SESSION)).toThrow("already running");

    expect(coordinator.end(token)).toBe(true);
    expect(coordinator.getState().kind).toBe("idle");
    expect(() => coordinator.assertEditingAllowed()).not.toThrow();
  });

  it("rejects a stale token after a newer workflow begins", () => {
    const coordinator = new ActiveLayoutWorkflowCoordinator();
    const first = coordinator.begin("recommend", null);
    coordinator.end(first);
    const second = coordinator.begin("recommend", null);

    expect(coordinator.isCurrent(first)).toBe(false);
    expect(coordinator.isCurrent(second)).toBe(true);
    expect(second.revision).toBeGreaterThan(first.revision);
  });

  it("requires the expected session to remain unchanged", () => {
    const coordinator = new ActiveLayoutWorkflowCoordinator();
    const token = coordinator.begin("feedback", TEST_SESSION);
    const otherSession = { ...TEST_SESSION, layoutId: TEST_SESSION.layoutId + 1 };

    expect(coordinator.isCurrent(token, TEST_SESSION)).toBe(true);
    expect(coordinator.isCurrent(token, otherSession)).toBe(false);
  });

  it("exposes the lock used by edit enqueue wrappers", () => {
    globalToken = beginActiveLayoutWorkflow("feedback", TEST_SESSION);
    expect(() => assertActiveLayoutEditingAllowed()).toThrow("locked by feedback");
    endActiveLayoutWorkflow(globalToken);
    globalToken = null;
    expect(() => assertActiveLayoutEditingAllowed()).not.toThrow();
  });

  it("isolates a throwing subscriber", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const coordinator = new ActiveLayoutWorkflowCoordinator();
    const healthyListener = vi.fn();
    coordinator.subscribe(() => {
      throw new Error("listener");
    });
    coordinator.subscribe(healthyListener);

    const token = coordinator.begin("confirm", TEST_SESSION);
    expect(healthyListener).toHaveBeenCalledTimes(1);
    coordinator.end(token);
    expect(healthyListener).toHaveBeenCalledTimes(2);
  });
});
