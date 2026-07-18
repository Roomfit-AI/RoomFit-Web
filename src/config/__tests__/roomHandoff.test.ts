import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import {
  ACTIVE_CLIENT_SCOPE_KEY,
  BROWSER_CLIENT_ID_KEY,
  clearPendingClientHandoff,
  getActiveRequestClientId,
  readActiveClientScope,
  readPendingClientHandoff,
} from "../clientScope";
import {
  commitRoomHandoff,
  initializeRoomHandoff,
  toHandoffErrorMessage,
} from "../roomHandoff";
import { readRoomSetupSession } from "../roomSetupSession";

const BROWSER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("Room App handoff bootstrap", () => {
  it("stores APP_UUID before routing the root handoff to /rooms", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage();
    const replaced: string[] = [];

    initializeRoomHandoff(
      location(`https://roomfit.example/?roomId=42&clientId=${APP_ID}`),
      history(replaced),
      local,
      session,
    );

    expect(readPendingClientHandoff(session)).toMatchObject({
      mode: "APP_UUID",
      clientId: APP_ID,
      backendRoomId: 42,
    });
    expect(getActiveRequestClientId(local, session)).toBe(APP_ID);
    expect(new URL(replaced[0]).pathname).toBe("/rooms");
  });

  it("keeps a roomId-only handoff header-less despite an existing browser UUID", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage();

    initializeRoomHandoff(
      location("https://roomfit.example/?roomId=42"),
      history([]),
      local,
      session,
    );

    expect(readPendingClientHandoff(session)?.mode).toBe("LEGACY_HANDOFF");
    expect(getActiveRequestClientId(local, session)).toBeNull();
  });

  it("treats an invalid clientId with a valid roomId as legacy", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage();

    initializeRoomHandoff(
      location("https://roomfit.example/?roomId=42&clientId=invalid"),
      history([]),
      local,
      session,
    );

    expect(readPendingClientHandoff(session)?.mode).toBe("LEGACY_HANDOFF");
    expect(getActiveRequestClientId(local, session)).toBeNull();
  });

  it("ignores clientId-only input and uses the existing browser identity", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage();

    initializeRoomHandoff(
      location(`https://roomfit.example/?clientId=${APP_ID}`),
      history([]),
      local,
      session,
    );

    expect(readPendingClientHandoff(session)).toBeNull();
    expect(getActiveRequestClientId(local, session)).toBe(BROWSER_ID);
  });

  it("commits the Room, setup owner, and App scope only after a successful lookup", () => {
    const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    const session = createMemoryStorage();
    const handoff = initializePendingAppHandoff(local, session);

    commitRoomHandoff(uploadedRoom(42), handoff, local, session, "setup-app");

    expect(local.getItem("roomfit:backendRoomId")).toBe("42");
    expect(local.getItem("roomfit:selectedRoomId")).toBe("api-room-42");
    expect(readRoomSetupSession(session)).toMatchObject({
      sessionId: "setup-app",
      roomLayoutId: "api-room-42",
      backendRoomId: 42,
      mode: "NEW",
    });
    expect(readActiveClientScope(session)).toMatchObject({
      mode: "APP_UUID",
      clientId: APP_ID,
      setupSessionId: "setup-app",
      backendRoomId: 42,
    });
    expect(readPendingClientHandoff(session)).toBeNull();
  });

  it("does not overwrite an existing selection or active scope when lookup fails", () => {
    const local = createMemoryStorage({
      [BROWSER_CLIENT_ID_KEY]: BROWSER_ID,
      "roomfit:selectedRoomId": "api-room-7",
      "roomfit:backendRoomId": "7",
    });
    const session = createMemoryStorage({
      [ACTIVE_CLIENT_SCOPE_KEY]: JSON.stringify({
        version: 1,
        mode: "BROWSER_UUID",
        clientId: BROWSER_ID,
        setupSessionId: "setup-existing",
        backendRoomId: 7,
        roomLayoutId: "api-room-7",
      }),
    });
    initializePendingAppHandoff(local, session);

    clearPendingClientHandoff(session);

    expect(local.getItem("roomfit:selectedRoomId")).toBe("api-room-7");
    expect(local.getItem("roomfit:backendRoomId")).toBe("7");
    expect(readActiveClientScope(session)).toMatchObject({
      mode: "BROWSER_UUID",
      backendRoomId: 7,
      roomLayoutId: "api-room-7",
    });
  });

  it("distinguishes ownership 404, forbidden 403, and network failures", () => {
    const notFound = new AxiosError("not found", "ERR_BAD_REQUEST", undefined, undefined, { status: 404 } as never);
    const forbidden = new AxiosError("forbidden", "ERR_BAD_REQUEST", undefined, undefined, { status: 403 } as never);
    const network = new AxiosError("network", "ERR_NETWORK");

    expect(toHandoffErrorMessage(notFound)).toContain("찾을 수 없거나 접근");
    expect(toHandoffErrorMessage(forbidden)).toContain("허용하지 않았습니다");
    expect(toHandoffErrorMessage(network)).toContain("네트워크 연결");
  });
});

function initializePendingAppHandoff(local: MemoryStorage, session: MemoryStorage) {
  initializeRoomHandoff(
    location(`https://roomfit.example/rooms?roomId=42&clientId=${APP_ID}`),
    history([]),
    local,
    session,
  );
  return readPendingClientHandoff(session)!;
}

function uploadedRoom(roomId: number) {
  return {
    roomId,
    title: "App 업로드 방",
    size: "12㎡",
    dimensions: "4m × 3m",
    tone: "bright",
    category: "업로드 방",
    source: "ROOMPLAN",
    createdAt: "2026-07-19T00:00:00Z",
    layoutId: `api-room-${roomId}`,
    layout: {
      id: `api-room-${roomId}`,
      name: "App 업로드 방",
      width: 4,
      depth: 3,
      height: 2.4,
      source: "ROOMPLAN",
      walls: [],
      doors: [],
      windows: [],
      furniture: [],
    },
  };
}

function location(href: string) {
  return { href, pathname: new URL(href).pathname };
}

function history(replaced: string[]) {
  return {
    state: null,
    replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => {
      if (url) replaced.push(String(url));
    },
  };
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
