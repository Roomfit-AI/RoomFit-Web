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
import {
  BROWSER_CLIENT_ID_KEY,
  getActiveRequestClientId,
  readActiveClientScope,
} from "../clientScope";

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
      "roomfit:recommendationResult": "past-warning",
    });

    const session = beginNewRoomSetup(local, browser, "setup-B");

    expect(session.sessionId).toBe("setup-B");
    expect(local.getItem("roomfit:selectedPurpose")).toBeNull();
    expect(local.getItem("roomfit:selectedRoomId")).toBeNull();
    expect(browser.getItem("roomfit:visited:reference-image")).toBeNull();
    expect(browser.getItem("roomfit:recommendationResult")).toBeNull();
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

  it("migrates a pre-client-scope Backend Room session to legacy without attaching a Browser UUID", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: "11111111-1111-4111-8111-111111111111" });
    const browser = createMemoryStorage({
      "roomfit:roomSetupSession": JSON.stringify({
        version: 1,
        sessionId: "legacy-existing",
        roomLayoutId: "api-room-9",
        backendRoomId: 9,
        mode: "REEDIT",
        createdAt: "2026-07-19T00:00:00Z",
      }),
    });

    initializeRoomSetupSession(local, browser);

    expect(readActiveClientScope(browser)).toMatchObject({
      mode: "LEGACY_HANDOFF",
      clientId: null,
      backendRoomId: 9,
      roomLayoutId: "api-room-9",
    });
    expect(getActiveRequestClientId(local, browser)).toBeNull();
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

  it("clears Room A's recommendation warning when Room B becomes the setup owner", () => {
    const local = createMemoryStorage();
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "setup");
    bindRoomToSetupSession("api-room-1", 1, "NEW", local, browser);
    browser.setItem("roomfit:recommendationResult", "room-a-warning");

    bindRoomToSetupSession("api-room-2", 2, "NEW", local, browser);

    expect(browser.getItem("roomfit:recommendationResult")).toBeNull();
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
    local.setItem("roomfit:confirmedLayoutsByRoomId", JSON.stringify({ [room.id]: room }));
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

  it("does not treat a Backend Room ID as proof that a Layout exists", async () => {
    const room = createRoomLayout("api-room-8", "ROOMPLAN");
    const local = selectedTemplateStorage(room);
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "existing-without-layout");
    selectTemplate(local, room);
    local.setItem("roomfit:backendRoomId", "8");
    const createRoomApi = vi.fn();

    await prepareSelectedRoomForManagement(local, browser, createRoomApi);

    expect(createRoomApi).not.toHaveBeenCalled();
    expect(readRoomSetupSession(browser)).toMatchObject({
      roomLayoutId: room.id,
      backendRoomId: 8,
      mode: "NEW",
    });
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
    browser.setItem("roomfit:recommendationResult", "warning");

    completeRoomSetupSession(browser);

    expect(readRoomSetupSession(browser)).toBeNull();
    expect(browser.getItem("roomfit:recommendationResult")).toBeNull();
    expect(local.getItem("roomfit:selectedRoomId")).toBe("api-room-9");
    expect(getActiveRequestClientId(local, browser)).toBe(local.getItem(BROWSER_CLIENT_ID_KEY));
  });

  it("keeps the same browser identity while a new setup replaces Room ownership", () => {
    const local = createMemoryStorage();
    const browser = createMemoryStorage();
    beginNewRoomSetup(local, browser, "setup-a");
    bindRoomToSetupSession("api-room-1", 1, "NEW", local, browser);
    const clientId = getActiveRequestClientId(local, browser);

    beginNewRoomSetup(local, browser, "setup-b");
    bindRoomToSetupSession("api-room-2", 2, "NEW", local, browser);

    expect(getActiveRequestClientId(local, browser)).toBe(clientId);
    expect(readActiveClientScope(browser)).toMatchObject({
      mode: "BROWSER_UUID",
      setupSessionId: "setup-b",
      roomLayoutId: "api-room-2",
      backendRoomId: 2,
    });
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
