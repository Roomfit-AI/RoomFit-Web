import type { SampleRoomCard } from "../api/rooms";
import { activateAppClientScope } from "./clientScope";
import { hasConfirmedLayout } from "./confirmedLayouts";
import { persistRoomSelection, type CustomRoomCard } from "./customRoom";
import {
  beginNewRoomSetup,
  bindRoomToSetupSession,
  restoreRoomPreferencesForSetup,
  type RoomSetupMode,
} from "./roomSetupSession";
import type { RoomCardScope } from "./scopedRoomCards";

type SelectionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type SelectableRoom = SampleRoomCard | CustomRoomCard;

export interface ScopedRoomSelectionResult {
  backendRoomId: number | null;
  setupMode: RoomSetupMode;
}

export function selectScopedRoom(
  room: SelectableRoom,
  scope: RoomCardScope,
  clientId: string | undefined,
  storage: SelectionStorage = localStorage,
  browserSession: SelectionStorage = sessionStorage,
): ScopedRoomSelectionResult {
  const setup = beginNewRoomSetup(storage, browserSession);
  if (scope === "PAIRED_APP") {
    activateAppClientScope(clientId, setup.sessionId, browserSession);
  }

  const backendRoomId = scope === "PUBLIC" || room.layout.source === "CUSTOM"
    ? null
    : "roomId" in room
      ? room.roomId
      : null;
  const setupMode = backendRoomId !== null && hasConfirmedLayout(room.layoutId, storage, clientId ?? null)
    ? "REEDIT"
    : "NEW";

  persistRoomSelection(backendRoomId === null ? { ...room, roomId: undefined } : room, storage);
  bindRoomToSetupSession(room.layoutId, backendRoomId, setupMode, storage, browserSession);
  storage.removeItem("roomfit:confirmedRoomLayout");
  restoreRoomPreferencesForSetup(room.layoutId, setupMode, storage);
  return { backendRoomId, setupMode };
}
