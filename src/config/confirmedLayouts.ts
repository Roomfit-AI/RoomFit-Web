import { applyScenario, currentScenario } from "./scenarios";
import { sampleRoom } from "../mock/sampleRoom";
import type { RoomLayout } from "../types";

// Local confirmed snapshots are display/recovery caches keyed by the stable
// UI room id. Backend Layout confirm remains the source of truth; reopening a
// room resolves the latest confirmed Layout before editing begins.
const CONFIRMED_LAYOUTS_KEY = "roomfit:confirmedLayoutsByRoomId";

function readAll(): Record<string, RoomLayout> {
  const raw = localStorage.getItem(CONFIRMED_LAYOUTS_KEY);

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

export function saveConfirmedLayout(roomLayoutId: string, layout: RoomLayout): void {
  const all = readAll();
  all[roomLayoutId] = layout;
  localStorage.setItem(CONFIRMED_LAYOUTS_KEY, JSON.stringify(all));
}

export function getConfirmedLayout(roomLayoutId: string): RoomLayout | null {
  return readAll()[roomLayoutId] ?? null;
}

export function hasConfirmedLayout(roomLayoutId: string): boolean {
  return Boolean(readAll()[roomLayoutId]);
}

// Legacy confirmed mirror, written only after Backend confirm. Editing pages
// recover active work from the Backend Draft session and selectedRoomLayout,
// so this cache is always a lower-priority display fallback.
export function getLiveMirrorForSelectedRoom(): RoomLayout | null {
  const confirmed = localStorage.getItem("roomfit:confirmedRoomLayout");
  const selectedRoomId = localStorage.getItem("roomfit:selectedRoomId");

  if (!confirmed) {
    return null;
  }

  try {
    const parsedConfirmed = JSON.parse(confirmed) as RoomLayout;
    return !selectedRoomId || parsedConfirmed.id === selectedRoomId ? parsedConfirmed : null;
  } catch {
    return null;
  }
}

// The room as it should be shown/confirmed right now — shared by
// LayoutConfirm.tsx (to display it) and Navbar.tsx (its own "확정하기" button
// on the last step confirms whatever this resolves to, without needing the
// page's local state).
export function resolveCurrentRoomLayout(): RoomLayout {
  const liveMirror = getLiveMirrorForSelectedRoom();

  if (liveMirror) {
    return liveMirror;
  }

  // Only reached when the user lands here without ever visiting /editor —
  // apply the scripted scenario once as a fallback so the confirm preview
  // isn't just the bare as-uploaded room.
  const selected = localStorage.getItem("roomfit:selectedRoomLayout");

  if (!selected) {
    return sampleRoom;
  }

  try {
    const room = JSON.parse(selected) as RoomLayout;
    const scenario = currentScenario();
    return scenario ? applyScenario(room, scenario) : room;
  } catch {
    return sampleRoom;
  }
}
