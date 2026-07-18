import { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../client";
import {
  BROWSER_CLIENT_ID_KEY,
  CLIENT_ID_HEADER,
  activateBrowserClientScope,
  clearPendingClientHandoff,
  resolveClientScopeForHandoff,
  savePendingClientHandoff,
} from "../../config/clientScope";

const BROWSER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("apiClient client scope header", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("injects the App UUID into the actual Axios request config", async () => {
    const { local, session } = installStorage();
    savePendingClientHandoff(resolveClientScopeForHandoff({ roomId: 42, clientId: APP_ID })!, session);

    expect(await requestHeader()).toBe(APP_ID);
    expect(local.getItem(BROWSER_CLIENT_ID_KEY)).toBe(BROWSER_ID);
  });

  it("injects the browser UUID for a normal Web request", async () => {
    const { local, session } = installStorage();
    activateBrowserClientScope("setup-browser", local, session);

    expect(await requestHeader()).toBe(BROWSER_ID);
  });

  it("does not send an empty or Browser UUID header for legacy handoff", async () => {
    const { session } = installStorage();
    savePendingClientHandoff(resolveClientScopeForHandoff({ roomId: 42, clientId: null })!, session);

    expect(await requestHeader()).toBeUndefined();
  });

  it("omits the Client ID header completely for an explicit PUBLIC request", async () => {
    const { local, session } = installStorage();
    activateBrowserClientScope("setup-browser", local, session);

    expect(await requestHeader("PUBLIC", APP_ID)).toBeUndefined();
  });

  it("uses an explicit UUID instead of an active App or Browser scope", async () => {
    const { session } = installStorage();
    savePendingClientHandoff(resolveClientScopeForHandoff({ roomId: 42, clientId: APP_ID })!, session);

    expect(await requestHeader("EXPLICIT", BROWSER_ID)).toBe(BROWSER_ID);
  });

  it("keeps PUBLIC headerless even when an override and active scope exist", async () => {
    const { session } = installStorage();
    savePendingClientHandoff(resolveClientScopeForHandoff({ roomId: 42, clientId: APP_ID })!, session);

    expect(await requestHeader("PUBLIC", BROWSER_ID)).toBeUndefined();
  });

  it("reads the current scope at request time instead of capturing an earlier ID", async () => {
    const { local, session } = installStorage();
    savePendingClientHandoff(resolveClientScopeForHandoff({ roomId: 42, clientId: APP_ID })!, session);
    expect(await requestHeader()).toBe(APP_ID);

    clearPendingClientHandoff(session);
    activateBrowserClientScope("setup-browser", local, session);

    expect(await requestHeader()).toBe(BROWSER_ID);
  });
});

function installStorage() {
  const local = createMemoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
  const session = createMemoryStorage();
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
  return { local, session };
}

async function requestHeader(
  roomfitClientScope?: "SCOPED" | "PUBLIC" | "EXPLICIT",
  clientId?: string,
): Promise<string | undefined> {
  let requestConfig: InternalAxiosRequestConfig | undefined;
  await apiClient.get("/__client-scope-test__", {
    roomfitClientScope,
    roomfitClientIdOverride: roomfitClientScope === "EXPLICIT" ? clientId : undefined,
    headers: clientId ? { [CLIENT_ID_HEADER]: clientId } : undefined,
    adapter: async (config) => {
      requestConfig = config;
      return {
        data: null,
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        config,
      };
    },
  });
  return requestConfig?.headers.get(CLIENT_ID_HEADER)?.toString();
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
