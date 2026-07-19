import type { RoomLayout } from "../../types";

export interface EditorLayoutHistory {
  roomLayout: RoomLayout | null;
  scopeKey: string;
  undoSnapshot: RoomLayout | null;
  pendingSnapshot: RoomLayout | null;
  editInProgress: boolean;
}

type LayoutUpdate = (current: RoomLayout) => RoomLayout;

export type EditorLayoutHistoryAction =
  | { type: "replace"; scopeKey: string; roomLayout: RoomLayout | null }
  | { type: "edit"; scopeKey: string; update: LayoutUpdate }
  | { type: "beginEdit"; scopeKey: string }
  | { type: "updateEdit"; scopeKey: string; update: LayoutUpdate }
  | { type: "endEdit"; scopeKey: string }
  | { type: "undo"; scopeKey: string };

export function createEditorLayoutHistory(
  roomLayout: RoomLayout | null,
  scopeKey: string,
): EditorLayoutHistory {
  return {
    roomLayout,
    scopeKey,
    undoSnapshot: null,
    pendingSnapshot: null,
    editInProgress: false,
  };
}

export function canUndoEditorLayout(
  state: EditorLayoutHistory,
  scopeKey: string,
): boolean {
  return state.scopeKey === scopeKey
    && state.roomLayout !== null
    && state.undoSnapshot?.id === state.roomLayout.id;
}

export function reduceEditorLayoutHistory(
  state: EditorLayoutHistory,
  action: EditorLayoutHistoryAction,
): EditorLayoutHistory {
  if (action.type === "replace") {
    return createEditorLayoutHistory(action.roomLayout, action.scopeKey);
  }

  if (action.scopeKey !== state.scopeKey || !state.roomLayout) {
    return state;
  }

  switch (action.type) {
    case "edit":
      return applyUpdate(state, action.update, state.roomLayout, false);
    case "beginEdit":
      return {
        ...state,
        pendingSnapshot: state.roomLayout,
        editInProgress: true,
      };
    case "updateEdit":
      return applyUpdate(
        state,
        action.update,
        state.editInProgress ? state.pendingSnapshot : state.roomLayout,
        state.editInProgress,
      );
    case "endEdit":
      return {
        ...state,
        pendingSnapshot: null,
        editInProgress: false,
      };
    case "undo":
      if (!canUndoEditorLayout(state, action.scopeKey)) return state;
      return createEditorLayoutHistory(state.undoSnapshot, state.scopeKey);
  }
}

function applyUpdate(
  state: EditorLayoutHistory,
  update: LayoutUpdate,
  snapshot: RoomLayout | null,
  preservePending: boolean,
): EditorLayoutHistory {
  const next = update(state.roomLayout!);
  if (next === state.roomLayout || next.id !== state.roomLayout!.id) {
    return state;
  }

  return {
    ...state,
    roomLayout: next,
    undoSnapshot: snapshot ?? state.undoSnapshot,
    pendingSnapshot: preservePending ? state.pendingSnapshot : null,
    editInProgress: preservePending,
  };
}
