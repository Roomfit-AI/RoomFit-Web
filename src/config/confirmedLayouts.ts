import type { RoomLayout } from "../types";
import { getActiveRequestClientId } from "./clientScope";

// Local confirmed snapshots are display/recovery caches keyed by the stable
// UI room id. Backend Layout confirm remains the source of truth; reopening a
// room resolves the latest confirmed Layout before editing begins.
const CONFIRMED_LAYOUTS_KEY = "roomfit:confirmedLayoutsByRoomId";
const CONFIRMED_LAYOUT_OWNERS_KEY = "roomfit:confirmedLayoutOwnersByRoomId:v1";

type ConfirmedLayoutStorage = Pick<Storage, "getItem" | "setItem">;

function readAll(storage: Pick<ConfirmedLayoutStorage, "getItem"> = localStorage): Record<string, RoomLayout> {
  const raw = storage.getItem(CONFIRMED_LAYOUTS_KEY);

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

export function saveConfirmedLayout(
  roomLayoutId: string,
  layout: RoomLayout,
  storage: ConfirmedLayoutStorage = localStorage,
): void {
  const all = readAll(storage);
  all[roomLayoutId] = layout;
  storage.setItem(CONFIRMED_LAYOUTS_KEY, JSON.stringify(all));
  const owners = readOwners(storage);
  owners[roomLayoutId] = readActiveOwner();
  storage.setItem(CONFIRMED_LAYOUT_OWNERS_KEY, JSON.stringify(owners));
}

export function getConfirmedLayout(
  roomLayoutId: string,
  storage: Pick<ConfirmedLayoutStorage, "getItem"> = localStorage,
): RoomLayout | null {
  return readAll(storage)[roomLayoutId] ?? null;
}

export function hasConfirmedLayout(
  roomLayoutId: string,
  storage: Pick<ConfirmedLayoutStorage, "getItem"> = localStorage,
  clientId?: string | null,
): boolean {
  if (!readAll(storage)[roomLayoutId]) return false;
  if (clientId === undefined) return true;
  const storedOwner = readOwners(storage)[roomLayoutId];
  return storedOwner === undefined || storedOwner === ownerKey(clientId);
}

export function clearConfirmedLayout(
  roomLayoutId: string,
  storage: ConfirmedLayoutStorage = localStorage,
): void {
  const all = readAll(storage);
  if (!(roomLayoutId in all)) return;
  delete all[roomLayoutId];
  storage.setItem(CONFIRMED_LAYOUTS_KEY, JSON.stringify(all));
  const owners = readOwners(storage);
  delete owners[roomLayoutId];
  storage.setItem(CONFIRMED_LAYOUT_OWNERS_KEY, JSON.stringify(owners));
}

function readOwners(
  storage: Pick<ConfirmedLayoutStorage, "getItem"> = localStorage,
): Record<string, string> {
  const raw = storage.getItem(CONFIRMED_LAYOUT_OWNERS_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, string>
      : {};
  } catch {
    return {};
  }
}

function readActiveOwner(): string {
  try {
    return ownerKey(getActiveRequestClientId());
  } catch {
    return ownerKey(null);
  }
}

function ownerKey(clientId: string | null): string {
  return clientId ?? "LEGACY";
}

// Legacy confirmed mirror, written only after Backend confirm. Editing pages
// recover active work from the Backend Draft session and selectedRoomLayout,
// so this cache is always a lower-priority display fallback.
export function getLiveMirrorForSelectedRoom(): RoomLayout | null {
  const confirmed = localStorage.getItem("roomfit:confirmedRoomLayout");
  const selectedRoomId = localStorage.getItem("roomfit:selectedRoomId");

  if (!confirmed || !selectedRoomId) {
    return null;
  }

  const storedOwner = readOwners()[selectedRoomId];
  if (storedOwner !== readActiveOwner()) return null;

  try {
    const parsedConfirmed = JSON.parse(confirmed) as RoomLayout;
    return parsedConfirmed.id === selectedRoomId ? parsedConfirmed : null;
  } catch {
    return null;
  }
}

// The room as it should be shown/confirmed right now — shared by
// LayoutConfirm.tsx (to display it) and Navbar.tsx (its own "확정하기" button
// on the last step confirms whatever this resolves to, without needing the
// page's local state).
export function resolveCurrentRoomLayout(): RoomLayout | null {
  const liveMirror = getLiveMirrorForSelectedRoom();

  if (liveMirror) {
    return liveMirror;
  }

  // Only reached when the user lands here without an active Editor mirror.
  // Preserve the selected room exactly; recommendation results must come
  // from the persisted Backend Layout, never from a preference-based script.
  const selected = localStorage.getItem("roomfit:selectedRoomLayout");

  if (!selected) {
    return null;
  }

  try {
    return JSON.parse(selected) as RoomLayout;
  } catch {
    return null;
  }
}
