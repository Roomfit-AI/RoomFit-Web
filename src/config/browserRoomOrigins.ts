export const BROWSER_ROOM_ORIGINS_KEY = "roomfit:browserRoomOrigins:v1";

export type BrowserRoomOrigin = "DIRECT" | "SAMPLE_COPY";

type OriginStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveBrowserRoomOrigin(
  roomId: number,
  origin: BrowserRoomOrigin,
  storage: OriginStorage = localStorage,
): void {
  if (!Number.isInteger(roomId) || roomId <= 0) return;
  const origins = readOrigins(storage);
  origins[String(roomId)] = origin;
  storage.setItem(BROWSER_ROOM_ORIGINS_KEY, JSON.stringify(origins));
}

export function getBrowserRoomOrigin(
  roomId: number,
  storage: Pick<OriginStorage, "getItem"> = localStorage,
): BrowserRoomOrigin | null {
  return readOrigins(storage)[String(roomId)] ?? null;
}

export function clearBrowserRoomOrigin(
  roomId: number,
  storage: OriginStorage = localStorage,
): void {
  const origins = readOrigins(storage);
  if (!(String(roomId) in origins)) return;
  delete origins[String(roomId)];
  storage.setItem(BROWSER_ROOM_ORIGINS_KEY, JSON.stringify(origins));
}

function readOrigins(storage: Pick<OriginStorage, "getItem">): Record<string, BrowserRoomOrigin> {
  try {
    const raw = storage.getItem(BROWSER_ROOM_ORIGINS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value === "DIRECT" || value === "SAMPLE_COPY"));
  } catch {
    return {};
  }
}
