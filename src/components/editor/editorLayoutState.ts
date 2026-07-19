import type { RoomLayout } from "../../types";

export interface EditorLayoutState {
  roomLayout: RoomLayout | null;
  baselineLayout: RoomLayout | null;
  scopeKey: string;
  editInProgress: boolean;
  dragChanged: boolean;
  isPersisting: boolean;
  persistenceRequest: EditorLayoutPersistenceRequest | null;
}

export interface EditorLayoutPersistenceRequest {
  requestId: number;
  scopeKey: string;
  roomLayout: RoomLayout;
}

export interface EditorLayoutScopeOwner {
  roomLayoutId: string | null;
  backendRoomId: number | null;
  activeLayoutId: number | null;
  clientMode: string | null;
  clientId: string | null;
  setupSessionId: string | null;
  scopedRoomLayoutId: string | null;
  scopedBackendRoomId: number | null;
}

type LayoutUpdate = (current: RoomLayout) => RoomLayout;

export type EditorLayoutStateAction =
  | { type: "replace"; scopeKey: string; roomLayout: RoomLayout | null }
  | { type: "edit"; scopeKey: string; update: LayoutUpdate }
  | { type: "beginEdit"; scopeKey: string }
  | { type: "updateEdit"; scopeKey: string; update: LayoutUpdate }
  | { type: "endEdit"; scopeKey: string }
  | { type: "resetFurniture"; scopeKey: string; furnitureId: string }
  | { type: "finishPersistence"; scopeKey: string; requestId: number };

export function createEditorLayoutScopeKey(owner: EditorLayoutScopeOwner): string {
  return JSON.stringify(owner);
}

export function createEditorLayoutState(
  roomLayout: RoomLayout | null,
  scopeKey: string,
): EditorLayoutState {
  return {
    roomLayout,
    baselineLayout: roomLayout,
    scopeKey,
    editInProgress: false,
    dragChanged: false,
    isPersisting: false,
    persistenceRequest: null,
  };
}

export function canResetEditorFurniture(
  state: EditorLayoutState,
  scopeKey: string,
  furnitureId: string | null,
): boolean {
  if (!furnitureId
    || state.scopeKey !== scopeKey
    || !state.roomLayout
    || !state.baselineLayout
    || state.roomLayout.id !== state.baselineLayout.id) {
    return false;
  }

  return state.roomLayout.furniture.some((item) => item.id === furnitureId)
    && state.baselineLayout.furniture.some((item) => item.id === furnitureId);
}

export function reduceEditorLayoutState(
  state: EditorLayoutState,
  action: EditorLayoutStateAction,
): EditorLayoutState {
  if (action.type === "replace") {
    return createEditorLayoutState(action.roomLayout, action.scopeKey);
  }

  if (action.scopeKey !== state.scopeKey || !state.roomLayout) {
    return state;
  }

  switch (action.type) {
    case "edit":
      return applyUpdate(state, action.update, false, true);
    case "beginEdit":
      return state.editInProgress
        ? state
        : { ...state, editInProgress: true, dragChanged: false };
    case "updateEdit":
      if (!state.editInProgress) return state;
      return applyUpdate(state, action.update, true, false);
    case "endEdit":
      if (!state.editInProgress) return state;
      return {
        ...state,
        editInProgress: false,
        dragChanged: false,
        isPersisting: state.dragChanged || state.isPersisting,
        persistenceRequest: state.dragChanged
          ? createPersistenceRequest(state, state.roomLayout)
          : state.persistenceRequest,
      };
    case "resetFurniture": {
      if (!canResetEditorFurniture(state, action.scopeKey, action.furnitureId)) return state;
      const baselineFurniture = state.baselineLayout!.furniture.find(
        (item) => item.id === action.furnitureId,
      )!;
      const currentFurniture = state.roomLayout.furniture.find(
        (item) => item.id === action.furnitureId,
      );
      if (currentFurniture === baselineFurniture) return state;

      const roomLayout = {
        ...state.roomLayout,
        furniture: state.roomLayout.furniture.map((item) => (
          item.id === action.furnitureId ? baselineFurniture : item
        )),
      };
      return {
        ...state,
        roomLayout,
        editInProgress: false,
        dragChanged: false,
        isPersisting: true,
        persistenceRequest: createPersistenceRequest(state, roomLayout),
      };
    }
    case "finishPersistence":
      return state.persistenceRequest?.requestId === action.requestId
        ? { ...state, isPersisting: false }
        : state;
  }
}

function applyUpdate(
  state: EditorLayoutState,
  update: LayoutUpdate,
  editInProgress: boolean,
  persist: boolean,
): EditorLayoutState {
  const next = update(state.roomLayout!);
  if (next === state.roomLayout || next.id !== state.roomLayout!.id) {
    return state;
  }

  return {
    ...state,
    roomLayout: next,
    editInProgress,
    dragChanged: editInProgress ? true : false,
    isPersisting: persist ? true : state.isPersisting,
    persistenceRequest: persist
      ? createPersistenceRequest(state, next)
      : state.persistenceRequest,
  };
}

function createPersistenceRequest(
  state: EditorLayoutState,
  roomLayout: RoomLayout,
): EditorLayoutPersistenceRequest {
  return {
    requestId: (state.persistenceRequest?.requestId ?? 0) + 1,
    scopeKey: state.scopeKey,
    roomLayout,
  };
}
