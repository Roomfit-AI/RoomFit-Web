import { describe, expect, it, vi } from "vitest";

import type { RoomLayout } from "../../types";
import {
  readActiveLayoutEditingSession,
  saveActiveLayoutEditingSession,
} from "../layoutEditingSession";
import {
  beginNewRoomSetup,
  bindRoomToSetupSession,
  completeRoomSetupSession,
  getSelectedRoomIdForSetup,
  initializeRoomSetupSession,
  prepareSelectedRoomForManagement,
  readRoomSetupSession,
  restoreRoomPreferencesForSetup,
} from "../roomSetupSession";

describe("room setup session", () => {
  it("clears only temporary setup state when a completely new flow begins", () => {
    const local = createMemoryStorage({
      "roomfit:selectedPurpose": "work",
      "roomfit:selectedPalette": "blue",
      "roomfit:selectedStyle": "modern",
      "roomfit:selectedAdditionalFurnitureIds": JSON.stringify(["desk"]),
      "roomfit:selectedRoomId": "api-room-7",
      "roomfit:backendRoomId": "7",
      "roomfit:confirmedRoomLayout": "confirmed-live-mirror",
      "roomfit:preferencesByRoomId": "permanent-preferences",
      "roomfit:confirmedLayoutsByRoomId": "permanent-layouts",
      "roomfit:roomThumbnails": "permanent-thumbnails",
    });
    const browser = createMemoryStorage({
      "roomfit:visited:preference": "true",
      "roomfit:visited:reference-image": "true",
      "roomfit:visited:add-furniture": "true",
    });

    const session = beginNewRoomSetup(local, browser, "setup-B");

    expect(session.sessionId).toBe("setup-B");
    expect(local.getItem("roomfit:selectedPurpose")).toBeNull();
    expect(local.getItem("roomfit:selectedRoomId")).toBeNull();
    expect(browser.getItem("roomfit:visited:reference-image")).toBeNull();
    expect(local.getItem("roomfit:preferencesByRoomId")).toBe("permanent-preferences");
    expect(local.getItem("roomfit:confirmedLayoutsByRoomId")).toBe("permanent-layouts");
    expect(local.getItem("roomfit:roomThumbnails")).toBe("permanent-thumbnails");
  });

  it("keeps selections when navigating backward within the same setup session", () => {
    const local = createMemoryStorage();
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "same-session");
    local.setItem("roomfit:selectedPurpose", "rest");
    browser.setItem("roomfit:visited:preference", "true");

    const restored = initializeRoomSetupSession(local, browser);

    expect(restored.sessionId).toBe("same-session");
    expect(local.getItem("roomfit:selectedPurpose")).toBe("rest");
    expect(browser.getItem("roomfit:visited:preference")).toBe("true");
  });

  it("does not restore preferences saved under a reusable sample template ID", () => {
    const local = createMemoryStorage({
      "roomfit:preferencesByRoomId": JSON.stringify({
        "api-room-1": {
          purpose: "work",
          palette: "blue",
          style: "modern",
          additionalFurnitureIds: ["desk"],
        },
      }),
    });

    restoreRoomPreferencesForSetup("api-room-1", "NEW", local);

    expect(local.getItem("roomfit:selectedPurpose")).toBeNull();
    expect(local.getItem("roomfit:selectedPalette")).toBeNull();
    expect(local.getItem("roomfit:selectedStyle")).toBeNull();
    expect(local.getItem("roomfit:selectedAdditionalFurnitureIds")).toBe("[]");
  });

  it("restores the selected Room's own preferences for explicit re-edit", () => {
    const local = createMemoryStorage({
      "roomfit:preferencesByRoomId": JSON.stringify({
        "api-room-7": {
          purpose: "rest",
          palette: "brown",
          style: "natural",
          additionalFurnitureIds: ["mood-lamp"],
        },
      }),
    });

    restoreRoomPreferencesForSetup("api-room-7", "REEDIT", local);

    expect(local.getItem("roomfit:selectedPurpose")).toBe("rest");
    expect(local.getItem("roomfit:selectedPalette")).toBe("brown");
    expect(local.getItem("roomfit:selectedStyle")).toBe("natural");
    expect(local.getItem("roomfit:selectedAdditionalFurnitureIds")).toBe('["mood-lamp"]');
  });

  it("clears Room A's active Draft when Room B becomes the setup owner", () => {
    const local = createMemoryStorage();
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "setup");
    saveActiveLayoutEditingSession({
      roomLayoutId: "api-room-1",
      backendRoomId: 1,
      activeLayoutId: 101,
      sourceLayoutId: 91,
      editingMode: "REEDIT_DRAFT",
      confirmed: false,
    }, local);

    bindRoomToSetupSession("api-room-2", 2, "REEDIT", local, browser);

    expect(readActiveLayoutEditingSession(local)).toBeNull();
    expect(readRoomSetupSession(browser)).toMatchObject({
      roomLayoutId: "api-room-2",
      backendRoomId: 2,
      mode: "REEDIT",
    });
  });

  it("creates a sample template with POST semantics and never mutates the template", async () => {
    const template = createRoomLayout("sample-room", "SAMPLE");
    const original = structuredClone(template);
    const local = selectedTemplateStorage(template);
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "sample-setup");
    selectTemplate(local, template);
    const createRoomApi = vi.fn().mockResolvedValue(42);

    const result = await prepareSelectedRoomForManagement(local, browser, createRoomApi);

    expect(createRoomApi).toHaveBeenCalledTimes(1);
    expect(createRoomApi).toHaveBeenCalledWith(template);
    expect(result).toEqual({ created: true, roomLayoutId: "api-room-42", backendRoomId: 42 });
    expect(local.getItem("roomfit:backendRoomId")).toBe("42");
    expect(local.getItem("roomfit:selectedRoomId")).toBe("api-room-42");
    expect(JSON.parse(local.getItem("roomfit:selectedRoomLayout") ?? "null")).toMatchObject({
      id: "api-room-42",
      source: "ROOMPLAN",
    });
    expect(template).toEqual(original);
  });

  it("uses the same POST creation contract for a custom room", async () => {
    const template = createRoomLayout("custom-room-draft", "CUSTOM");
    const local = selectedTemplateStorage(template);
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "custom-setup");
    selectTemplate(local, template);
    const createRoomApi = vi.fn().mockResolvedValue(43);

    await expect(prepareSelectedRoomForManagement(local, browser, createRoomApi)).resolves.toEqual({
      created: true,
      roomLayoutId: "api-room-43",
      backendRoomId: 43,
    });
    expect(createRoomApi).toHaveBeenCalledTimes(1);
  });

  it("does not POST when an existing Backend Room is explicitly selected for re-edit", async () => {
    const room = createRoomLayout("api-room-7", "ROOMPLAN");
    const local = selectedTemplateStorage(room);
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "reedit-setup");
    selectTemplate(local, room);
    local.setItem("roomfit:backendRoomId", "7");
    const createRoomApi = vi.fn();

    const result = await prepareSelectedRoomForManagement(local, browser, createRoomApi);

    expect(result).toEqual({ created: false, roomLayoutId: "api-room-7", backendRoomId: 7 });
    expect(createRoomApi).not.toHaveBeenCalled();
    expect(readRoomSetupSession(browser)?.mode).toBe("REEDIT");
  });

  it("keeps a failed new Room retryable without restoring a stale Backend ID", async () => {
    const template = createRoomLayout("sample-room", "SAMPLE");
    const local = selectedTemplateStorage(template);
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "failed-setup");
    selectTemplate(local, template);
    const createRoomApi = vi.fn().mockRejectedValue(new Error("network"));

    await expect(prepareSelectedRoomForManagement(local, browser, createRoomApi)).rejects.toThrow("network");

    expect(local.getItem("roomfit:backendRoomId")).toBeNull();
    expect(local.getItem("roomfit:selectedRoomId")).toBe("sample-room");
    expect(JSON.parse(local.getItem("roomfit:selectedRoomLayout") ?? "null")).toEqual(template);
  });

  it("reuses the created Room ID after success instead of posting the same setup again", async () => {
    const template = createRoomLayout("sample-room", "SAMPLE");
    const local = selectedTemplateStorage(template);
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "single-post");
    selectTemplate(local, template);
    const createRoomApi = vi.fn().mockResolvedValue(51);

    await prepareSelectedRoomForManagement(local, browser, createRoomApi);
    await prepareSelectedRoomForManagement(local, browser, createRoomApi);

    expect(createRoomApi).toHaveBeenCalledTimes(1);
    expect(getSelectedRoomIdForSetup(local, browser)).toBe("api-room-51");
  });

  it("ends the setup boundary after confirmation without deleting Room data", () => {
    const local = createMemoryStorage({ "roomfit:selectedRoomId": "api-room-9" });
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "confirming");
    local.setItem("roomfit:selectedRoomId", "api-room-9");

    completeRoomSetupSession(browser);

    expect(readRoomSetupSession(browser)).toBeNull();
    expect(local.getItem("roomfit:selectedRoomId")).toBe("api-room-9");
  });
});

function createRoomLayout(id: string, source: string): RoomLayout {
  return {
    id,
    name: `${source} 테스트 방`,
    width: 4,
    depth: 3,
    height: 2.4,
    unit: "meter",
    source,
    walls: [],
    doors: [],
    windows: [],
    furniture: [],
  };
}

function selectedTemplateStorage(room: RoomLayout): MemoryStorage {
  return createMemoryStorage({
    "roomfit:selectedRoomId": room.id,
    "roomfit:selectedRoomTitle": room.name,
    "roomfit:selectedRoomType": "원룸",
    "roomfit:selectedRoomSize": "12㎡",
    "roomfit:selectedRoomLayout": JSON.stringify(room),
  });
}

function selectTemplate(storage: MemoryStorage, room: RoomLayout): void {
  storage.setItem("roomfit:selectedRoomId", room.id);
  storage.setItem("roomfit:selectedRoomTitle", room.name);
  storage.setItem("roomfit:selectedRoomType", "원룸");
  storage.setItem("roomfit:selectedRoomSize", "12㎡");
  storage.setItem("roomfit:selectedRoomLayout", JSON.stringify(room));
}

interface MemoryStorage extends Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  values: Map<string, string>;
}

function createMemoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}
