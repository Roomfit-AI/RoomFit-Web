import { describe, expect, it } from "vitest";

import type { UploadedRoomCard } from "../../api/rooms";
import { ACTIVE_CLIENT_SCOPE_KEY, BROWSER_CLIENT_ID_KEY, readActiveClientScope } from "../clientScope";
import { selectScopedRoom } from "../roomCardSelection";
import { readRoomSetupSession } from "../roomSetupSession";

const BROWSER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("scope-aware Room card selection", () => {
  it("activates the paired App UUID and keeps a new App Room out of REEDIT", () => {
    const local = memoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = memoryStorage();

    expect(selectScopedRoom(room(42), "PAIRED_APP", APP_ID, local, session)).toEqual({
      backendRoomId: 42,
      setupMode: "NEW",
    });
    expect(readActiveClientScope(session)).toMatchObject({ mode: "APP_UUID", clientId: APP_ID, backendRoomId: 42 });
  });

  it("switches an active App session back to the Browser UUID", () => {
    const local = memoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = memoryStorage({
      [ACTIVE_CLIENT_SCOPE_KEY]: JSON.stringify({
        version: 1,
        mode: "APP_UUID",
        clientId: APP_ID,
        setupSessionId: "old",
        backendRoomId: 42,
        roomLayoutId: "api-room-42",
      }),
    });

    selectScopedRoom(room(7), "BROWSER", BROWSER_ID, local, session);
    expect(readActiveClientScope(session)).toMatchObject({ mode: "BROWSER_UUID", clientId: BROWSER_ID, backendRoomId: 7 });
  });

  it("keeps a PUBLIC Sample headerless until its later Browser-owned copy", () => {
    const local = memoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = memoryStorage();
    const sample = room(1);
    sample.layout.source = "SAMPLE";

    expect(selectScopedRoom(sample, "PUBLIC", BROWSER_ID, local, session).backendRoomId).toBeNull();
    expect(local.getItem("roomfit:backendRoomId")).toBeNull();
    expect(readRoomSetupSession(session)).toMatchObject({ mode: "NEW", backendRoomId: null });
    expect(readActiveClientScope(session)).toMatchObject({ mode: "BROWSER_UUID", clientId: BROWSER_ID });
  });

  it("enters REEDIT only when the selected Room has confirmed evidence", () => {
    const selected = room(7);
    const local = memoryStorage({
      [BROWSER_CLIENT_ID_KEY]: BROWSER_ID,
      "roomfit:confirmedLayoutsByRoomId": JSON.stringify({ [selected.layoutId]: selected.layout }),
    });
    const session = memoryStorage();

    expect(selectScopedRoom(selected, "BROWSER", BROWSER_ID, local, session).setupMode).toBe("REEDIT");
  });
});

function room(roomId: number): UploadedRoomCard {
  return {
    roomId,
    title: `Room ${roomId}`,
    size: "12㎡",
    dimensions: "4m × 3m",
    tone: "white",
    category: "업로드 방",
    source: "ROOMPLAN",
    createdAt: "2026-07-19T00:00:00Z",
    layoutId: `api-room-${roomId}`,
    layout: { id: `api-room-${roomId}`, name: `Room ${roomId}`, width: 4, depth: 3, height: 2.4, source: "ROOMPLAN", walls: [], doors: [], windows: [], furniture: [] },
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
