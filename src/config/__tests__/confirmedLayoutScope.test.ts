import { describe, expect, it, vi } from "vitest";

import type { RoomLayout } from "../../types";
import {
  BROWSER_CLIENT_ID_KEY,
  activateAppClientScope,
  activateBrowserClientScope,
} from "../clientScope";
import {
  getLiveMirrorForSelectedRoom,
  hasConfirmedLayout,
  resolveCurrentRoomLayout,
  saveConfirmedLayout,
} from "../confirmedLayouts";

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

    local.setItem("roomfit:selectedRoomId", layout.id);
    local.setItem("roomfit:confirmedRoomLayout", JSON.stringify(layout));
    activateBrowserClientScope("setup-browser", local, session);
    expect(getLiveMirrorForSelectedRoom()).toBeNull();
    vi.unstubAllGlobals();
  });

  it("does not synthesize a scenario Layout when confirm is opened without an Editor mirror", () => {
    const selected = room();
    selected.furniture = [{
      id: "existing-desk",
      name: "기존 책상",
      category: "desk",
      dimensions: { width: 1, depth: 0.6, height: 0.72 },
      position: { x: 0, z: 0 },
      rotationY: 0,
      color: "#fff",
      material: "wood",
      status: "existing",
      removable: true,
    }];
    const local = memoryStorage({
      "roomfit:selectedRoomLayout": JSON.stringify(selected),
      "roomfit:selectedPurpose": "rest",
      "roomfit:selectedStyle": "natural",
      "roomfit:selectedPalette": "brown",
    });
    vi.stubGlobal("localStorage", local);

    expect(resolveCurrentRoomLayout()).toEqual(selected);
    vi.unstubAllGlobals();
  });

  it("does not invent a Sample Layout when confirm has no selected room state", () => {
    vi.stubGlobal("localStorage", memoryStorage());

    expect(resolveCurrentRoomLayout()).toBeNull();
    vi.unstubAllGlobals();
  });

  it("does not treat a legacy unowned confirmed mirror as scoped recovery evidence", () => {
    const layout = room();
    const local = memoryStorage({
      [BROWSER_CLIENT_ID_KEY]: BROWSER_ID,
      "roomfit:selectedRoomId": layout.id,
      "roomfit:confirmedRoomLayout": JSON.stringify(layout),
      "roomfit:confirmedLayoutsByRoomId": JSON.stringify({ [layout.id]: layout }),
    });
    const session = memoryStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    activateBrowserClientScope("setup-browser", local, session);

    expect(getLiveMirrorForSelectedRoom()).toBeNull();
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
