import { isAxiosError } from "axios";

import type { UploadedRoomCard } from "../api/rooms";
import { persistRoomSelection } from "./customRoom";
import {
  beginNewRoomSetup,
  bindRoomToSetupSession,
  restoreRoomPreferencesForSetup,
} from "./roomSetupSession";
import {
  activatePendingHandoffScope,
  activateBrowserClientScope,
  clearPendingClientHandoff,
  resolveClientScopeForHandoff,
  savePendingClientHandoff,
  type PendingClientHandoff,
} from "./clientScope";

export function toHandoffErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 404) {
      return "방을 찾을 수 없거나 접근할 수 없습니다. 공간 목록에서 다시 선택해 주세요.";
    }
    if (error.response?.status === 403) {
      return "서버가 방 조회 요청을 허용하지 않았습니다. 잠시 후 다시 시도해 주세요.";
    }
    if (!error.response) {
      return "서버에 연결하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
    }
  }
  return "방 정보를 불러오지 못했습니다. 공간 목록에서 다시 선택해 주세요.";
}

interface HandoffLocation {
  href: string;
  pathname: string;
}

interface HandoffHistory {
  state: unknown;
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

type HandoffStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function commitRoomHandoff(
  room: UploadedRoomCard,
  handoff: PendingClientHandoff,
  storage: HandoffStorage = localStorage,
  browserSession: HandoffStorage = sessionStorage,
  setupSessionId?: string,
): void {
  if (room.roomId !== handoff.backendRoomId) {
    throw new Error("App handoff Room 응답이 요청한 Room과 일치하지 않습니다.");
  }

  const setup = beginNewRoomSetup(storage, browserSession, setupSessionId);
  activatePendingHandoffScope(handoff, setup.sessionId, room.layoutId, browserSession);
  persistRoomSelection(room, storage);
  bindRoomToSetupSession(room.layoutId, room.roomId, "NEW", storage, browserSession);
  restoreRoomPreferencesForSetup(room.layoutId, "NEW", storage);
  clearPendingClientHandoff(browserSession);
}

export function initializeRoomHandoff(
  location: HandoffLocation = window.location,
  history: HandoffHistory = window.history,
  storage: HandoffStorage = localStorage,
  browserSession: HandoffStorage = sessionStorage,
): void {
  const url = new URL(location.href);
  const hasRoomId = url.searchParams.has("roomId");
  const hasClientId = url.searchParams.has("clientId");
  if (!hasRoomId && !hasClientId) return;

  const handoff = resolveClientScopeForHandoff({
    roomId: url.searchParams.get("roomId"),
    clientId: url.searchParams.get("clientId"),
  });

  if (handoff) {
    savePendingClientHandoff(handoff, browserSession);
    if (location.pathname === "/") {
      url.pathname = "/rooms";
      history.replaceState(history.state, "", url);
    }
    return;
  }

  clearPendingClientHandoff(browserSession);
  if (hasClientId) activateBrowserClientScope(null, storage, browserSession);
}
