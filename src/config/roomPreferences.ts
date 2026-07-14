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

function readAll(): Record<string, RoomPreferences> {
  const raw = localStorage.getItem(ROOM_PREFERENCES_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRoomPreferences(roomLayoutId: string, preferences: RoomPreferences): void {
  const all = readAll();
  all[roomLayoutId] = preferences;
  localStorage.setItem(ROOM_PREFERENCES_KEY, JSON.stringify(all));
}

export function getRoomPreferences(roomLayoutId: string): RoomPreferences {
  return readAll()[roomLayoutId] ?? EMPTY_PREFERENCES;
}

// Reads whatever /preference, /reference-image, and /add-furniture currently
// have live in localStorage — used at confirm time to snapshot "what this
// room actually ended up using" into the per-room store above.
export function readCurrentPreferences(): RoomPreferences {
  const rawIds = localStorage.getItem("roomfit:selectedAdditionalFurnitureIds");
  let additionalFurnitureIds: string[] = [];

  if (rawIds) {
    try {
      const parsed = JSON.parse(rawIds);
      additionalFurnitureIds = Array.isArray(parsed) ? parsed : [];
    } catch {
      additionalFurnitureIds = [];
    }
  }

  return {
    purpose: localStorage.getItem("roomfit:selectedPurpose") ?? "",
    palette: localStorage.getItem("roomfit:selectedPalette") ?? "",
    style: localStorage.getItem("roomfit:selectedStyle") ?? "",
    additionalFurnitureIds,
  };
}

// Writes a room's saved (or blank) preferences into the same live
// localStorage keys /preference etc. read from — called by Rooms.tsx's
// selectRoom so the next visit to those pages picks the right one up.
export function applyPreferencesToStorage(preferences: RoomPreferences): void {
  if (preferences.purpose) {
    localStorage.setItem("roomfit:selectedPurpose", preferences.purpose);
  } else {
    localStorage.removeItem("roomfit:selectedPurpose");
  }

  if (preferences.palette) {
    localStorage.setItem("roomfit:selectedPalette", preferences.palette);
  } else {
    localStorage.removeItem("roomfit:selectedPalette");
  }

  if (preferences.style) {
    localStorage.setItem("roomfit:selectedStyle", preferences.style);
  } else {
    localStorage.removeItem("roomfit:selectedStyle");
  }

  localStorage.setItem("roomfit:selectedAdditionalFurnitureIds", JSON.stringify(preferences.additionalFurnitureIds));
}
