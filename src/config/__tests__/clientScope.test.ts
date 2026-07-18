import { describe, expect, it } from "vitest";

import {
  ACTIVE_CLIENT_SCOPE_KEY,
  BROWSER_CLIENT_ID_KEY,
  PENDING_CLIENT_HANDOFF_KEY,
  activateBrowserClientScope,
  activatePendingHandoffScope,
  adoptBrowserClientId,
  bindActiveClientScopeToRoom,
  clearActiveClientScope,
  clearPendingClientHandoff,
  getActiveRequestClientId,
  getOrCreateBrowserClientId,
  getStoredBrowserClientId,
  readActiveClientScope,
  resolveClientScopeForHandoff,
  savePendingClientHandoff,
  validateClientId,
} from "../clientScope";

const BROWSER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("client scope identity", () => {
  it("creates a browser UUID once and reuses it", () => {
    const storage = createMemoryStorage();
    const createUuid = () => BROWSER_ID;

    expect(getOrCreateBrowserClientId(storage, createUuid)).toBe(BROWSER_ID);
    expect(getOrCreateBrowserClientId(storage, () => APP_ID)).toBe(BROWSER_ID);
    expect(storage.getItem(BROWSER_CLIENT_ID_KEY)).toBe(BROWSER_ID);
  });

  it("rejects malformed stored and query client IDs", () => {
    const storage = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: "not-a-uuid" });

    expect(validateClientId(APP_ID)).toBe(true);
    expect(validateClientId("")).toBe(false);
    expect(validateClientId("not-a-uuid")).toBe(false);
    expect(getStoredBrowserClientId(storage)).toBeNull();
    expect(storage.getItem(BROWSER_CLIENT_ID_KEY)).toBeNull();
  });

  it("resolves roomId and a valid clientId as APP_UUID", () => {
    expect(resolveClientScopeForHandoff({ roomId: "42", clientId: APP_ID })).toEqual({
      version: 1,
      mode: "APP_UUID",
      clientId: APP_ID,
      backendRoomId: 42,
    });
  });

  it("resolves missing or invalid clientId with a valid roomId as legacy", () => {
    expect(resolveClientScopeForHandoff({ roomId: "42", clientId: null })?.mode).toBe("LEGACY_HANDOFF");
    expect(resolveClientScopeForHandoff({ roomId: "42", clientId: "bad" })?.mode).toBe("LEGACY_HANDOFF");
  });

  it("does not treat clientId-only input as an App handoff", () => {
    expect(resolveClientScopeForHandoff({ roomId: null, clientId: APP_ID })).toBeNull();
  });

  it("gives a pending App handoff precedence over an existing browser scope", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage();
    activateBrowserClientScope("setup-old", local, session);
    savePendingClientHandoff(resolveClientScopeForHandoff({ roomId: 42, clientId: APP_ID })!, session);

    expect(getActiveRequestClientId(local, session)).toBe(APP_ID);
  });

  it("omits the client ID for legacy even when a browser UUID exists", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage();
    savePendingClientHandoff(resolveClientScopeForHandoff({ roomId: 42, clientId: null })!, session);

    expect(getActiveRequestClientId(local, session)).toBeNull();
  });

  it("keeps App scope across reload-style reads and Editor/Add Furniture room binding", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage();
    const handoff = resolveClientScopeForHandoff({ roomId: 42, clientId: APP_ID })!;
    activatePendingHandoffScope(handoff, "setup-app", "api-room-42", session);
    clearPendingClientHandoff(session);

    bindActiveClientScopeToRoom("setup-app", "api-room-42", 42, local, session);

    expect(readActiveClientScope(session)).toMatchObject({
      mode: "APP_UUID",
      clientId: APP_ID,
      setupSessionId: "setup-app",
      backendRoomId: 42,
      roomLayoutId: "api-room-42",
    });
    expect(getActiveRequestClientId(local, session)).toBe(APP_ID);
  });

  it("does not inherit an App scope when a new browser setup becomes active", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage({
      [ACTIVE_CLIENT_SCOPE_KEY]: JSON.stringify({
        version: 1,
        mode: "APP_UUID",
        clientId: APP_ID,
        setupSessionId: "setup-app",
        backendRoomId: 42,
        roomLayoutId: "api-room-42",
      }),
    });

    activateBrowserClientScope("setup-browser", local, session);

    expect(readActiveClientScope(session)).toMatchObject({
      mode: "BROWSER_UUID",
      clientId: BROWSER_ID,
      setupSessionId: "setup-browser",
      backendRoomId: null,
    });
  });

  it("adopts a redeemed pairing-code clientId as this browser's permanent id", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage({
      [ACTIVE_CLIENT_SCOPE_KEY]: JSON.stringify({
        version: 1,
        mode: "BROWSER_UUID",
        clientId: BROWSER_ID,
        setupSessionId: "setup-browser",
        backendRoomId: null,
        roomLayoutId: null,
      }),
    });

    expect(adoptBrowserClientId(APP_ID, local, session)).toBe(APP_ID);

    // localStorage now permanently reports the adopted (app's) id...
    expect(local.getItem(BROWSER_CLIENT_ID_KEY)).toBe(APP_ID);
    expect(getOrCreateBrowserClientId(local, () => BROWSER_ID)).toBe(APP_ID);
    // ...and the stale session-scoped cache from before adoption is gone, so a
    // fresh read falls through to the newly-adopted browser id immediately
    // (no page navigation required for it to take effect).
    expect(readActiveClientScope(session)).toBeNull();
    expect(getActiveRequestClientId(local, session)).toBe(APP_ID);
  });

  it("rejects adopting a malformed clientId without touching storage", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage();

    expect(() => adoptBrowserClientId("not-a-uuid", local, session)).toThrow();
    expect(local.getItem(BROWSER_CLIENT_ID_KEY)).toBe(BROWSER_ID);
  });

  it("clearActiveClientScope removes only the active-scope cache", () => {
    const session = createMemoryStorage({
      [ACTIVE_CLIENT_SCOPE_KEY]: "irrelevant",
      [PENDING_CLIENT_HANDOFF_KEY]: "irrelevant",
    });

    clearActiveClientScope(session);

    expect(session.getItem(ACTIVE_CLIENT_SCOPE_KEY)).toBeNull();
    expect(session.getItem(PENDING_CLIENT_HANDOFF_KEY)).toBe("irrelevant");
  });
});

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
