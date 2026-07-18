import { describe, expect, it } from "vitest";

import type { FeedbackResponse } from "../../api/layouts";
import {
  readActiveLayoutEditingSession,
  saveLayoutResponseSession,
} from "../layoutEditingSession";

describe("layout feedback Draft session", () => {
  it("replaces the active Draft ID with the feedback response layoutId", () => {
    const storage = createMemoryStorage();
    saveLayoutResponseSession("room-ui-7", createResponse(11), storage);

    saveLayoutResponseSession("room-ui-7", createResponse(27), storage);

    const session = readActiveLayoutEditingSession(storage);
    expect(session?.activeLayoutId).toBe(27);
    expect(session?.backendRoomId).toBe(7);
    expect(session?.sourceLayoutId).toBeNull();
  });
});

function createResponse(layoutId: number): FeedbackResponse & { layoutId: number } {
  return {
    layoutId,
    roomId: 7,
    sourceLayoutId: null,
    confirmed: false,
    confirmedAt: null,
    status: "SUCCESS",
    recommendedFurniture: [],
    scoreSummary: {
      collisionScore: 20,
      boundaryScore: 20,
      doorWindowScore: 15,
      pathScore: 15,
      goalScore: 15,
      styleScore: 15,
      totalScore: 100,
    },
    validationResult: {
      collisionFree: true,
      boundaryValid: true,
      doorClearance: true,
      windowClearance: true,
      pathSecured: true,
      warnings: [],
    },
  };
}

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
