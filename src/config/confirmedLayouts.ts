import { applyScenario, currentScenario } from "./scenarios";
import { sampleRoom } from "../mock/sampleRoom";
import type { RoomLayout } from "../types";

// Confirmed layouts persist locally only — there's no backend endpoint to
// save a finalized layout back to a room (see api/rooms.ts), so "확정하기"
// keeps the result on this device, keyed by the room's own layout id
// (stable across sessions — see api/rooms.ts's `api-room-${roomId}`) so the
// same physical room shows its confirmed result again next time it's opened.
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

// roomfit:confirmedRoomLayout (see EditorPlaceholder.tsx's effect) mirrors
// every manual edit made in /editor (drag, rotate, delete, feedback) — not
// just formally-confirmed ones — the moment they happen, live, within the
// current session. But it's a single global key, not scoped per room, and
// only gets refreshed by actually visiting /editor. Switching to a different
// room on /rooms and jumping straight past /editor (to /layout-confirm, or
// back into /editor again for a room that was already edited earlier this
// session) without an /editor visit in between leaves this holding
// whichever room's data was mirrored last — showing that *other* room's
// furniture/area "stuck" under the one actually selected now, or a
// previously-edited room's changes appearing to "reset" back to its raw
// as-uploaded state. Only trust it when its id still matches whichever room
// is currently selected; null means there's nothing to trust yet (a brand
// new room this session has never touched /editor for).
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
