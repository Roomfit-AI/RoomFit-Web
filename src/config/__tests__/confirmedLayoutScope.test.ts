import { describe, expect, it, vi } from "vitest";

import type { RoomLayout } from "../../types";
import { BROWSER_CLIENT_ID_KEY, activateAppClientScope } from "../clientScope";
import { hasConfirmedLayout, saveConfirmedLayout } from "../confirmedLayouts";

const BROWSER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("confirmed Layout scope ownership", () => {
  it("does not reuse an App confirmation for a Browser card with the same numeric roomId", () => {
    const local = memoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = memoryStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    activateAppClientScope(APP_ID, "setup-app", session);

    const layout = room();
    saveConfirmedLayout(layout.id, layout, local);

    expect(hasConfirmedLayout(layout.id, local, APP_ID)).toBe(true);
    expect(hasConfirmedLayout(layout.id, local, BROWSER_ID)).toBe(false);
    vi.unstubAllGlobals();
  });
});

function room(): RoomLayout {
  return { id: "api-room-15", name: "Room", width: 4, depth: 3, height: 2.4, source: "ROOMPLAN", walls: [], doors: [], windows: [], furniture: [] };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
