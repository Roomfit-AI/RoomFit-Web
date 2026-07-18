import {
  addFurnitureToDraft,
  confirmLayout,
  createDefaultAgentContext,
  createLayoutDraft,
  getLatestConfirmedLayout,
  getLayout,
  recommendLayout,
  updateLayout,
  type LayoutRecommendationResponse,
  type LayoutResponse,
} from "../api/layouts";
import { resolveRequiredFurnitureTypes } from "../api/agentContextRequest";
import { applyBackendFurnitureToLayout, getRoomById } from "../api/rooms";
import type { RoomLayout } from "../types";
import {
  resolveRoomLayoutPreferredColorTone,
  withAppliedPreferredColorTone,
} from "./appliedColorTone";
import {
  clearActiveLayoutEditingSession,
  createInitialSetupNavigationState,
  createLayoutNavigationState,
  isSessionForRoom,
  readActiveLayoutEditingSession,
  saveLayoutResponseSession,
  type LayoutNavigationState,
} from "./layoutEditingSession";
import {
  clearRecommendationResult,
  RecommendationFeasibilityError,
  resolveRecommendationDecision,
  saveRecommendationResult,
  type RecommendationResultOwner,
} from "./recommendationResult";
import { clearConfirmedLayout, hasConfirmedLayout } from "./confirmedLayouts";
import { bindRoomToSetupSession, readRoomSetupSession } from "./roomSetupSession";
import { currentScenario, isCollectorRoom } from "./scenarios";
import { isHobbyCoralRecommendationSelected } from "../mock/hobbyCoralRecommendation";
import { readPreferredColorTone } from "./preferredColorTone";

type WorkflowStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface LayoutWorkflowApi {
  getRoomLayout: (roomId: number) => Promise<RoomLayout>;
  getLayout: typeof getLayout;
  getLatestConfirmedLayout: typeof getLatestConfirmedLayout;
  createLayoutDraft: typeof createLayoutDraft;
  updateLayout: typeof updateLayout;
  addFurnitureToDraft: typeof addFurnitureToDraft;
  createDefaultAgentContext: typeof createDefaultAgentContext;
  recommendLayout: typeof recommendLayout;
  confirmLayout: typeof confirmLayout;
}

const defaultApi: LayoutWorkflowApi = {
  getRoomLayout: async (roomId) => (await getRoomById(roomId)).layout,
  getLayout,
  getLatestConfirmedLayout,
  createLayoutDraft,
  updateLayout,
  addFurnitureToDraft,
  createDefaultAgentContext,
  recommendLayout,
  confirmLayout,
};

export async function loadManagedFurnitureLayout(
  room: RoomLayout,
  backendRoomId: number,
  storage: WorkflowStorage = localStorage,
  api: LayoutWorkflowApi = defaultApi,
  browserSession: WorkflowStorage | null = defaultBrowserSession(),
): Promise<RoomLayout | null> {
  const session = readActiveLayoutEditingSession(storage);
  if (isSessionForRoom(session, room.id, backendRoomId) && !session.confirmed) {
    const response = await api.getLayout(session.activeLayoutId);
    assertLayoutOwner(response, backendRoomId);
    saveLayoutResponseSession(room.id, response, storage, session.editingMode);
    const restored = applyBackendFurnitureToLayout(room, response.recommendedFurniture);
    persistActiveDraftMirror(restored, storage);
    return restored;
  }

  if (!isConfirmedReedit(room.id, backendRoomId, storage, browserSession)) {
    return loadRoomDetailForInitialSetup(room, backendRoomId, storage, api, browserSession);
  }

  const response = await api.getLatestConfirmedLayout(backendRoomId);

  if (!response) {
    return loadRoomDetailForInitialSetup(room, backendRoomId, storage, api, browserSession, true);
  }
  assertLayoutOwner(response, backendRoomId);
  if (!response.confirmed) {
    saveLayoutResponseSession(room.id, response, storage, session?.editingMode);
  }
  const restored = applyBackendFurnitureToLayout(room, response.recommendedFurniture);
  if (!response.confirmed) {
    persistActiveDraftMirror(restored, storage);
  }
  return restored;
}

export async function prepareManagedFurnitureDraft(
  storage: WorkflowStorage = localStorage,
  api: LayoutWorkflowApi = defaultApi,
  browserSession: WorkflowStorage | null = defaultBrowserSession(),
): Promise<LayoutNavigationState | null> {
  const room = readSelectedRoomLayout(storage);
  const backendRoomId = parseBackendRoomId(storage.getItem("roomfit:backendRoomId"));
  if (!room || backendRoomId === null) return null;

  const session = readActiveLayoutEditingSession(storage);
  const active = isSessionForRoom(session, room.id, backendRoomId)
    ? await api.getLayout(session.activeLayoutId)
    : isConfirmedReedit(room.id, backendRoomId, storage, browserSession)
      ? await api.getLatestConfirmedLayout(backendRoomId)
      : null;

  if (!active) {
    recoverInitialSetupSession(room.id, backendRoomId, storage, browserSession);
    return createInitialSetupNavigationState(room.id, backendRoomId, room);
  }
  assertLayoutOwner(active, backendRoomId);

  const editable = active.confirmed
    ? await api.createLayoutDraft(active.layoutId)
    : active;
  assertActiveDraftResponse(editable, editable.layoutId, backendRoomId);
  saveLayoutResponseSession(room.id, editable, storage, "REEDIT_DRAFT");

  const saved = await api.updateLayout(editable.layoutId, room);
  assertActiveDraftResponse(saved, editable.layoutId, backendRoomId);
  const savedRoom = applyBackendFurnitureToLayout(room, saved.recommendedFurniture);
  persistActiveDraftMirror(savedRoom, storage);
  const savedSession = saveLayoutResponseSession(room.id, saved, storage, "REEDIT_DRAFT");
  return createLayoutNavigationState(savedSession, saved, savedRoom);
}

export async function refreshActiveDraftNavigationState(
  storage: WorkflowStorage = localStorage,
  api: LayoutWorkflowApi = defaultApi,
): Promise<LayoutNavigationState | null> {
  const room = readSelectedRoomLayout(storage);
  const backendRoomId = parseBackendRoomId(storage.getItem("roomfit:backendRoomId"));
  if (!room || backendRoomId === null) return null;

  const session = readActiveLayoutEditingSession(storage);
  if (!isSessionForRoom(session, room.id, backendRoomId) || session.confirmed) {
    return createInitialSetupNavigationState(room.id, backendRoomId, room);
  }

  const response = await api.getLayout(session.activeLayoutId);
  assertActiveDraftResponse(response, session.activeLayoutId, backendRoomId);
  const restored = applyBackendFurnitureToLayout(room, response.recommendedFurniture);
  persistActiveDraftMirror(restored, storage);
  const savedSession = saveLayoutResponseSession(room.id, response, storage, session.editingMode);
  return createLayoutNavigationState(savedSession, response, restored);
}

export async function prepareAdditionalFurnitureForEditor(
  storage: WorkflowStorage = localStorage,
  api: LayoutWorkflowApi = defaultApi,
  browserSession: WorkflowStorage = sessionStorage,
): Promise<LayoutNavigationState | null> {
  const current = await refreshActiveDraftNavigationState(storage, api);
  if (!current) {
    return current;
  }

  if (current.editingMode === "INITIAL_SETUP") {
    return prepareInitialRecommendation(current, storage, browserSession, api);
  }

  if (current.editingMode !== "REEDIT_DRAFT" || current.activeLayoutId === null) return current;

  const selectedIds = readStringArray(storage.getItem("roomfit:selectedAdditionalFurnitureIds"));
  if (resolveRequiredFurnitureTypes(selectedIds).length === 0) {
    return current;
  }

  const context = await api.createDefaultAgentContext(current.roomId);
  const response = await api.addFurnitureToDraft(current.activeLayoutId, {
    contextId: context.contextId,
  });
  assertActiveDraftResponse(response, current.activeLayoutId, current.roomId);

  const baseline = current.roomLayout ?? readSelectedRoomLayout(storage);
  if (!baseline) return current;
  const restored = applyBackendFurnitureToLayout(baseline, response.recommendedFurniture);
  persistActiveDraftMirror(restored, storage);
  const session = saveLayoutResponseSession(current.roomLayoutId, response, storage, "REEDIT_DRAFT");
  return createLayoutNavigationState(session, response, restored);
}

async function prepareInitialRecommendation(
  current: LayoutNavigationState,
  storage: WorkflowStorage,
  browserSession: WorkflowStorage,
  api: LayoutWorkflowApi,
): Promise<LayoutNavigationState> {
  const baseline = current.roomLayout ?? readSelectedRoomLayout(storage);
  if (!baseline || shouldUseLocalScenario(baseline, storage)) return current;

  const context = await api.createDefaultAgentContext(current.roomId);
  const response = await api.recommendLayout(current.roomId, context.contextId);
  const decision = resolveRecommendationDecision(response);
  const owner = resolveRecommendationOwner(current, browserSession);

  if (decision.status === "FAILED") {
    if (decision.notice && owner) {
      saveRecommendationResult(owner, decision.notice, browserSession);
    }
    throw new RecommendationFeasibilityError(decision.notice!);
  }

  const persistedResponse = requirePersistedRecommendation(response);
  assertLayoutOwner(persistedResponse, current.roomId);
  const recommended = applyBackendFurnitureToLayout(baseline, persistedResponse.recommendedFurniture);
  const restored = withAppliedPreferredColorTone(
    recommended,
    readPreferredColorTone(storage) ?? resolveRoomLayoutPreferredColorTone(baseline, storage),
  );
  persistActiveDraftMirror(restored, storage);
  const session = saveLayoutResponseSession(
    current.roomLayoutId,
    persistedResponse,
    storage,
    "INITIAL_SETUP",
  );

  if (decision.notice && owner) {
    saveRecommendationResult(owner, decision.notice, browserSession);
  } else if (owner) {
    clearRecommendationResult(browserSession, owner);
  }

  return createLayoutNavigationState(session, persistedResponse, restored);
}

export async function persistActiveEditorLayout(
  storage: WorkflowStorage = localStorage,
  api: LayoutWorkflowApi = defaultApi,
): Promise<LayoutNavigationState | null> {
  const room = readSelectedRoomLayout(storage);
  const backendRoomId = parseBackendRoomId(storage.getItem("roomfit:backendRoomId"));
  if (!room || backendRoomId === null) return null;

  const session = readActiveLayoutEditingSession(storage);
  if (!isSessionForRoom(session, room.id, backendRoomId) || session.confirmed) return null;

  const saved = await api.updateLayout(session.activeLayoutId, room);
  assertActiveDraftResponse(saved, session.activeLayoutId, backendRoomId);
  const savedRoom = applyBackendFurnitureToLayout(room, saved.recommendedFurniture);
  persistActiveDraftMirror(savedRoom, storage);
  const savedSession = saveLayoutResponseSession(room.id, saved, storage, session.editingMode);
  return createLayoutNavigationState(savedSession, saved, savedRoom);
}

export async function confirmActiveLayout(
  room: RoomLayout,
  storage: WorkflowStorage = localStorage,
  api: LayoutWorkflowApi = defaultApi,
): Promise<RoomLayout> {
  const persisted = await persistActiveEditorLayout(storage, api);
  const layoutToConfirm = persisted?.roomLayout ?? room;
  const backendRoomId = parseBackendRoomId(storage.getItem("roomfit:backendRoomId"));
  const session = readActiveLayoutEditingSession(storage);

  if (backendRoomId !== null && isSessionForRoom(session, room.id, backendRoomId)) {
    const response = await api.confirmLayout(session.activeLayoutId);
    if (!response.confirmed) {
      throw new Error("Backend did not confirm the active Draft layout.");
    }
    clearActiveLayoutEditingSession(storage);
  }

  return layoutToConfirm;
}

function readSelectedRoomLayout(storage: WorkflowStorage): RoomLayout | null {
  return parseRoomLayout(storage.getItem("roomfit:selectedRoomLayout"));
}

function parseRoomLayout(raw: string | null): RoomLayout | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RoomLayout;
    return parsed && typeof parsed.id === "string" && Array.isArray(parsed.furniture) ? parsed : null;
  } catch {
    return null;
  }
}

function persistActiveDraftMirror(room: RoomLayout, storage: WorkflowStorage): void {
  storage.setItem("roomfit:selectedRoomLayout", JSON.stringify(room));
}

function assertLayoutOwner(response: LayoutResponse, roomId: number): void {
  if (response.roomId !== roomId) {
    throw new Error("The Backend Layout belongs to a different Room.");
  }
}

function assertActiveDraftResponse(response: LayoutResponse, layoutId: number, roomId: number): void {
  if (response.layoutId !== layoutId || response.roomId !== roomId || response.confirmed) {
    throw new Error("The Backend response does not match the active Draft session.");
  }
}

function readStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseBackendRoomId(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isConfirmedReedit(
  roomLayoutId: string,
  backendRoomId: number,
  storage: WorkflowStorage,
  browserSession: WorkflowStorage | null,
): boolean {
  if (!browserSession) return false;
  const setup = readRoomSetupSession(browserSession);
  return setup?.mode === "REEDIT"
    && setup.roomLayoutId === roomLayoutId
    && setup.backendRoomId === backendRoomId
    && hasConfirmedLayout(roomLayoutId, storage);
}

async function loadRoomDetailForInitialSetup(
  room: RoomLayout,
  backendRoomId: number,
  storage: WorkflowStorage,
  api: LayoutWorkflowApi,
  browserSession: WorkflowStorage | null,
  clearStaleConfirmation = false,
): Promise<RoomLayout> {
  const backendRoom = await api.getRoomLayout(backendRoomId);
  if (backendRoom.id !== room.id) {
    throw new Error("Backend Room response does not match the selected Room.");
  }

  if (clearStaleConfirmation) {
    clearConfirmedLayout(room.id, storage);
  }
  clearActiveLayoutEditingSession(storage);
  recoverInitialSetupSession(room.id, backendRoomId, storage, browserSession);
  storage.setItem("roomfit:selectedRoomLayout", JSON.stringify(backendRoom));
  return backendRoom;
}

function recoverInitialSetupSession(
  roomLayoutId: string,
  backendRoomId: number,
  storage: WorkflowStorage,
  browserSession: WorkflowStorage | null,
): void {
  if (!browserSession) return;
  const setup = readRoomSetupSession(browserSession);
  if (setup?.roomLayoutId === roomLayoutId && setup.backendRoomId === backendRoomId && setup.mode !== "NEW") {
    bindRoomToSetupSession(roomLayoutId, backendRoomId, "NEW", storage, browserSession);
  }
}

function defaultBrowserSession(): WorkflowStorage | null {
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

function shouldUseLocalScenario(room: RoomLayout, storage: WorkflowStorage): boolean {
  if (isHobbyCoralRecommendationSelected(storage)) return true;
  return room.source !== "CUSTOM" && !isCollectorRoom(room) && Boolean(currentScenario(storage));
}

function resolveRecommendationOwner(
  current: LayoutNavigationState,
  browserSession: WorkflowStorage,
): RecommendationResultOwner | null {
  const setup = readRoomSetupSession(browserSession);
  if (!setup
    || setup.roomLayoutId !== current.roomLayoutId
    || setup.backendRoomId !== current.roomId) {
    return null;
  }
  return {
    sessionId: setup.sessionId,
    roomLayoutId: current.roomLayoutId,
    backendRoomId: current.roomId,
  };
}

function requirePersistedRecommendation(response: LayoutRecommendationResponse): LayoutResponse {
  if (!isPositiveInteger(response.layoutId)) {
    throw new Error("Backend recommendation response has no persisted layoutId.");
  }
  return { ...response, layoutId: response.layoutId };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
