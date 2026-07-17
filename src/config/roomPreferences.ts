import {
  normalizePreferredColorToneId,
  type PreferredColorToneId,
} from "./preferredColorTone";

// The live page selections use global keys. Confirmed preferences are also
// stored per room so selecting that room again can restore its own choices.
const ROOM_PREFERENCES_KEY = "roomfit:preferencesByRoomId";

export interface RoomPreferences {
  purpose: string;
  palette: PreferredColorToneId | "";
  style: string;
  additionalFurnitureIds: string[];
}

type RoomPreferencesStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function createEmptyPreferences(): RoomPreferences {
  return {
    purpose: "",
    palette: "",
    style: "",
    additionalFurnitureIds: [],
  };
}

export function normalizeRoomPreferences(value: unknown): RoomPreferences {
  if (!isRecord(value)) {
    return createEmptyPreferences();
  }

  const palette = normalizePreferredColorToneId(value.palette);
  return {
    purpose: typeof value.purpose === "string" ? value.purpose : "",
    palette: palette ?? "",
    style: typeof value.style === "string" ? value.style : "",
    additionalFurnitureIds: Array.isArray(value.additionalFurnitureIds)
      ? value.additionalFurnitureIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

function readAll(storage: RoomPreferencesStorage): Record<string, RoomPreferences> {
  try {
    const raw = storage.getItem(ROOM_PREFERENCES_KEY);
    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, preferences]) => isRecord(preferences))
        .map(([roomLayoutId, preferences]) => [
          roomLayoutId,
          normalizeRoomPreferences(preferences),
        ]),
    );
  } catch {
    return {};
  }
}

export function saveRoomPreferences(
  roomLayoutId: string,
  preferences: RoomPreferences,
  storage: RoomPreferencesStorage = localStorage,
): void {
  const all = readAll(storage);
  all[roomLayoutId] = normalizeRoomPreferences(preferences);
  storage.setItem(ROOM_PREFERENCES_KEY, JSON.stringify(all));
}

export function getRoomPreferences(
  roomLayoutId: string,
  storage: RoomPreferencesStorage = localStorage,
): RoomPreferences {
  const preferences = readAll(storage)[roomLayoutId];
  return preferences ? normalizeRoomPreferences(preferences) : createEmptyPreferences();
}

export function getRoomPreferredColorTone(
  roomLayoutId: string,
  storage: RoomPreferencesStorage = localStorage,
): PreferredColorToneId | null {
  return getRoomPreferences(roomLayoutId, storage).palette || null;
}

export function hasRoomPreferences(
  roomLayoutId: string,
  storage: RoomPreferencesStorage = localStorage,
): boolean {
  return Object.hasOwn(readAll(storage), roomLayoutId);
}

export function shouldClearInitialPreferences(
  hasVisitedPreferencePage: boolean,
  hasRestoredRoomPreferences: boolean,
): boolean {
  return !hasVisitedPreferencePage && !hasRestoredRoomPreferences;
}

// Reads the live values used by /preference, /reference-image and
// /add-furniture so they can be snapshotted for the current room.
export function readCurrentPreferences(
  storage: RoomPreferencesStorage = localStorage,
): RoomPreferences {
  const rawIds = storage.getItem("roomfit:selectedAdditionalFurnitureIds");
  let additionalFurnitureIds: string[] = [];

  if (rawIds) {
    try {
      const parsed: unknown = JSON.parse(rawIds);
      additionalFurnitureIds = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      additionalFurnitureIds = [];
    }
  }

  return {
    purpose: storage.getItem("roomfit:selectedPurpose") ?? "",
    palette: normalizePreferredColorToneId(storage.getItem("roomfit:selectedPalette")) ?? "",
    style: storage.getItem("roomfit:selectedStyle") ?? "",
    additionalFurnitureIds,
  };
}

// Restores a room's saved choices into the live keys consumed by each page.
export function applyPreferencesToStorage(
  preferences: RoomPreferences,
  storage: RoomPreferencesStorage = localStorage,
): void {
  const normalized = normalizeRoomPreferences(preferences);
  setOrRemove(storage, "roomfit:selectedPurpose", normalized.purpose);
  setOrRemove(storage, "roomfit:selectedPalette", normalized.palette);
  setOrRemove(storage, "roomfit:selectedStyle", normalized.style);
  storage.setItem(
    "roomfit:selectedAdditionalFurnitureIds",
    JSON.stringify([...normalized.additionalFurnitureIds]),
  );
}

function setOrRemove(storage: RoomPreferencesStorage, key: string, value: string): void {
  if (value) {
    storage.setItem(key, value);
  } else {
    storage.removeItem(key);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
