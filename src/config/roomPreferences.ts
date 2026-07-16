// /preference, /reference-image, /add-furniture each keep their own
// selection in a single global localStorage key, only clearing it once per
// browser session (the first time that page mounts — see each page's own
// `roomfit:visited:*` sessionStorage flag). That reset guards against a hard
// refresh showing stale data, but does nothing when the user simply goes
// back to /rooms and picks a *different* room — the previous room's
// purpose/palette/style/checked-furniture stay applied and have to be
// manually cleared. Scoping these per room (keyed the same way as
// confirmedLayouts.ts) lets Rooms.tsx's selectRoom restore whatever this
// specific room last had selected (so reopening an already-confirmed room
// reflects its actual confirmed choices) while resetting to blank for any
// room that's never been through this before (so a different room never
// inherits another room's leftover picks).
import { requireStorageWrite, safeStorageGet, safeStorageRemove, safeStorageSet } from "../api/safeStorage";

const ROOM_PREFERENCES_KEY = "roomfit:preferencesByRoomId";

export interface RoomPreferences {
  purpose: string;
  palette: string;
  style: string;
  additionalFurnitureIds: string[];
}

const EMPTY_PREFERENCES: RoomPreferences = {
  purpose: "",
  palette: "",
  style: "",
  additionalFurnitureIds: [],
};

export type RoomPreferencesReadResult =
  | { status: "valid"; preferences: RoomPreferences }
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "storage-error"; error: Error };

type RoomPreferencesMapReadResult =
  | { status: "valid"; preferencesByRoomId: Record<string, RoomPreferences> }
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "storage-error"; error: Error };

export function saveRoomPreferences(roomLayoutId: string, preferences: RoomPreferences): void {
  const readResult = readAll();
  if (readResult.status === "storage-error") {
    throw readResult.error;
  }
  const all = readResult.status === "valid" ? readResult.preferencesByRoomId : {};
  all[roomLayoutId] = preferences;
  requireStorageWrite(
    safeStorageSet("local", ROOM_PREFERENCES_KEY, JSON.stringify(all)),
    "Room preferences storage is unavailable",
  );
}

export function getRoomPreferences(roomLayoutId: string): RoomPreferences {
  const result = readRoomPreferences(roomLayoutId);
  if (result.status === "valid") {
    return result.preferences;
  }
  if (result.status === "storage-error") {
    console.warn("Room 취향 정보를 읽지 못해 기본값을 사용합니다.", result.error);
  } else if (result.status === "invalid") {
    console.warn("잘못된 Room 취향 정보를 무시하고 기본값을 사용합니다.");
  }
  return emptyPreferences();
}

export function readRoomPreferences(roomLayoutId: string): RoomPreferencesReadResult {
  const result = readAll();
  if (result.status !== "valid") {
    return result;
  }
  const preferences = result.preferencesByRoomId[roomLayoutId];
  return preferences
    ? { status: "valid", preferences: clonePreferences(preferences) }
    : { status: "missing" };
}

// Reads whatever /preference, /reference-image, and /add-furniture currently
// have live in localStorage — used at confirm time to snapshot "what this
// room actually ended up using" into the per-room store above.
export function readCurrentPreferences(): RoomPreferences {
  const rawIdsResult = safeStorageGet("local", "roomfit:selectedAdditionalFurnitureIds");
  if (rawIdsResult.status === "storage-error") {
    console.warn("추가 가구 취향 정보를 읽지 못해 기본값을 사용합니다.", rawIdsResult.error);
  }
  const rawIds = rawIdsResult.status === "success" ? rawIdsResult.value : null;
  let additionalFurnitureIds: string[] = [];

  if (rawIds) {
    try {
      const parsed = JSON.parse(rawIds);
      additionalFurnitureIds = Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
        ? parsed
        : [];
    } catch {
      additionalFurnitureIds = [];
    }
  }

  return {
    purpose: readCurrentPreferenceValue("roomfit:selectedPurpose"),
    palette: readCurrentPreferenceValue("roomfit:selectedPalette"),
    style: readCurrentPreferenceValue("roomfit:selectedStyle"),
    additionalFurnitureIds,
  };
}

// Writes a room's saved (or blank) preferences into the same live
// localStorage keys /preference etc. read from — called by Rooms.tsx's
// selectRoom so the next visit to those pages picks the right one up.
export function applyPreferencesToStorage(preferences: RoomPreferences): Error[] {
  const warnings = [
    writeOptionalPreference("roomfit:selectedPurpose", preferences.purpose),
    writeOptionalPreference("roomfit:selectedPalette", preferences.palette),
    writeOptionalPreference("roomfit:selectedStyle", preferences.style),
    safeStorageSet(
      "local",
      "roomfit:selectedAdditionalFurnitureIds",
      JSON.stringify(preferences.additionalFurnitureIds),
    ),
  ];
  return warnings.flatMap((result) => result.status === "storage-error" ? [result.error] : []);
}

function readAll(): RoomPreferencesMapReadResult {
  const result = safeStorageGet("local", ROOM_PREFERENCES_KEY);
  if (result.status === "missing") {
    return { status: "missing" };
  }
  if (result.status === "storage-error") {
    return result;
  }

  try {
    const parsed = JSON.parse(result.value) as unknown;
    if (!isRecord(parsed)) {
      return { status: "invalid" };
    }

    const entries = Object.entries(parsed);
    if (!entries.every(([, value]) => isRoomPreferences(value))) {
      return { status: "invalid" };
    }
    return {
      status: "valid",
      preferencesByRoomId: Object.fromEntries(
        entries.map(([roomId, preferences]) => [roomId, clonePreferences(preferences as RoomPreferences)]),
      ),
    };
  } catch {
    return { status: "invalid" };
  }
}

function readCurrentPreferenceValue(key: string): string {
  const result = safeStorageGet("local", key);
  if (result.status === "storage-error") {
    console.warn(`취향 설정 ${key}를 읽지 못해 기본값을 사용합니다.`, result.error);
  }
  return result.status === "success" ? result.value : "";
}

function writeOptionalPreference(key: string, value: string) {
  return value
    ? safeStorageSet("local", key, value)
    : safeStorageRemove("local", key);
}

function isRoomPreferences(value: unknown): value is RoomPreferences {
  return isRecord(value)
    && typeof value.purpose === "string"
    && typeof value.palette === "string"
    && typeof value.style === "string"
    && Array.isArray(value.additionalFurnitureIds)
    && value.additionalFurnitureIds.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clonePreferences(preferences: RoomPreferences): RoomPreferences {
  return {
    ...preferences,
    additionalFurnitureIds: [...preferences.additionalFurnitureIds],
  };
}

function emptyPreferences(): RoomPreferences {
  return clonePreferences(EMPTY_PREFERENCES);
}
