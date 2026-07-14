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

// The room as it should be shown/confirmed right now — shared by
// LayoutConfirm.tsx (to display it) and Navbar.tsx (its own "확정하기" button
// on the last step confirms whatever this resolves to, without needing the
// page's local state).
export function resolveCurrentRoomLayout(): RoomLayout {
  const confirmed = localStorage.getItem("roomfit:confirmedRoomLayout");
  const selectedRoomId = localStorage.getItem("roomfit:selectedRoomId");

  // roomfit:confirmedRoomLayout (see EditorPlaceholder.tsx's effect) already
  // has any matching scenario applied *and* every manual edit made in
  // /editor (drag, rotate, delete, feedback) baked in — re-running
  // applyScenario on it would be wrong, not just redundant: restyle/wall-snap
  // and pairChairWithDesk aren't idempotent the way the itemIds-guarded
  // build() step is, so a second pass silently re-snaps a manually-rotated
  // cabinet back to its wall-facing rotation and re-snaps a manually-moved
  // desk chair back to sit in front of the desk, discarding exactly the
  // edits this page is supposed to show as final.
  //
  // But it's a single global key, not scoped per room, and only gets
  // refreshed by actually visiting /editor. Switching to a different room
  // on /rooms and jumping straight here (or to the navbar's "확정하기")
  // without ever opening /editor for it leaves this holding the *previous*
  // room's data — showing that old room's furniture/area "stuck" under the
  // newly selected room. Only trust it when its id still matches whichever
  // room is currently selected.
  if (confirmed) {
    try {
      const parsedConfirmed = JSON.parse(confirmed) as RoomLayout;

      if (!selectedRoomId || parsedConfirmed.id === selectedRoomId) {
        return parsedConfirmed;
      }
    } catch {
      // fall through to the selected-room fallback below
    }
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
