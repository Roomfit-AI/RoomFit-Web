import { describe, expect, it } from "vitest";

import { BROWSER_CLIENT_ID_KEY } from "../clientScope";
import {
  PAIRED_APP_CLIENT_ID_KEY,
  clearPairedAppClientId,
  getPairedAppClientId,
  savePairedAppClientId,
} from "../pairedAppClient";

const BROWSER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("paired App client storage", () => {
  it("stores and restores a valid UUID without replacing the browser UUID", () => {
    const storage = memoryStorage({ [BROWSER_CLIENT_ID_KEY]: BROWSER_ID });
    expect(savePairedAppClientId(APP_ID.toUpperCase(), storage)).toBe(APP_ID);
    expect(getPairedAppClientId(storage)).toBe(APP_ID);
    expect(storage.getItem(BROWSER_CLIENT_ID_KEY)).toBe(BROWSER_ID);
  });

  it("rejects invalid UUIDs and removes damaged stored values", () => {
    const storage = memoryStorage({ [PAIRED_APP_CLIENT_ID_KEY]: "damaged" });
    expect(() => savePairedAppClientId("invalid", storage)).toThrow();
    expect(getPairedAppClientId(storage)).toBeNull();
    expect(storage.getItem(PAIRED_APP_CLIENT_ID_KEY)).toBeNull();
  });

  it("clears only the paired key", () => {
    const storage = memoryStorage({
      [BROWSER_CLIENT_ID_KEY]: BROWSER_ID,
      [PAIRED_APP_CLIENT_ID_KEY]: APP_ID,
    });
    clearPairedAppClientId(storage);
    expect(storage.getItem(PAIRED_APP_CLIENT_ID_KEY)).toBeNull();
    expect(storage.getItem(BROWSER_CLIENT_ID_KEY)).toBe(BROWSER_ID);
  });
});

function memoryStorage(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
