import { describe, expect, it } from "vitest";

import { clearBrowserRoomOrigin, getBrowserRoomOrigin, saveBrowserRoomOrigin } from "../browserRoomOrigins";
import { roomCardKey } from "../scopedRoomCards";

describe("Browser Room metadata", () => {
  it("tracks direct creation and Sample copies without inferring from Room DTO fields", () => {
    const storage = memoryStorage();
    saveBrowserRoomOrigin(7, "DIRECT", storage);
    saveBrowserRoomOrigin(8, "SAMPLE_COPY", storage);
    expect(getBrowserRoomOrigin(7, storage)).toBe("DIRECT");
    expect(getBrowserRoomOrigin(8, storage)).toBe("SAMPLE_COPY");
    clearBrowserRoomOrigin(7, storage);
    expect(getBrowserRoomOrigin(7, storage)).toBeNull();
  });

  it("uses scope and roomId together for React identity", () => {
    const room = { roomId: 15 } as never;
    expect(roomCardKey({ scope: "BROWSER", room })).toBe("browser:15");
    expect(roomCardKey({ scope: "PAIRED_APP", room })).toBe("paired_app:15");
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
