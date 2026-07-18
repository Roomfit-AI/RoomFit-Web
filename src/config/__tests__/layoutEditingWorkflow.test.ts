import { describe, expect, it, vi } from "vitest";

import {
  toFurniturePositionRequest,
  type LayoutRecommendationResponse,
  type LayoutResponse,
} from "../../api/layouts";
import type { BackendFurnitureApiItem } from "../../api/rooms";
import type { Furniture, RoomLayout } from "../../types";
import {
  confirmActiveLayout,
  loadManagedFurnitureLayout,
  prepareAdditionalFurnitureForEditor,
  prepareManagedFurnitureDraft,
  refreshActiveDraftNavigationState,
  type LayoutWorkflowApi,
} from "../layoutEditingWorkflow";
import {
  readActiveLayoutEditingSession,
  resolveEditorInitialRoomLayout,
  saveActiveLayoutEditingSession,
} from "../layoutEditingSession";
import {
  readRecommendationResult,
  RecommendationFeasibilityError,
} from "../recommendationResult";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("Draft layout editing workflow", () => {
  it("loads a newly created Room without making any Layout request", async () => {
    const room = createRoom("api-room-42");
    room.furniture = [];
    const storage = selectedRoomStorage(room, 42);
    const browser = setupBrowserStorage(room.id, 42, "custom-setup");
    const backendRoom = { ...room, name: "Backend custom room", furniture: [] };
    const api = fakeApi({ room: backendRoom });

    const restored = await loadManagedFurnitureLayout(room, 42, storage, api, browser);

    expect(restored).toEqual(backendRoom);
    expect(restored?.furniture).toEqual([]);
    expect(api.getRoomLayout).toHaveBeenCalledWith(42);
    expect(api.getLayout).not.toHaveBeenCalled();
    expect(api.getLatestConfirmedLayout).not.toHaveBeenCalled();
  });

  it("loads existing Room furniture before the first Layout exists", async () => {
    const room = createRoom("api-room-43");
    room.furniture = [];
    const storage = selectedRoomStorage(room, 43);
    const browser = setupBrowserStorage(room.id, 43, "custom-furniture-setup");
    const backendRoom = createRoom(room.id, -0.25, Math.PI / 2);
    const api = fakeApi({ room: backendRoom });

    const restored = await loadManagedFurnitureLayout(room, 43, storage, api, browser);

    expect(restored?.furniture.map((item) => item.id)).toEqual(["bed-1", "desk-1"]);
    expect(api.getRoomLayout).toHaveBeenCalledWith(43);
    expect(api.getLatestConfirmedLayout).not.toHaveBeenCalled();
  });

  it("keeps the existing Layout lookup path for a re-edit setup", async () => {
    const room = createRoom("api-room-7");
    const storage = selectedRoomStorage(room, 7);
    const browser = setupBrowserStorage(room.id, 7, "reedit-setup", "REEDIT");
    markConfirmed(storage, room);
    const latest = response(70, true, null, backendFurnitureFromRoom(room), 7);
    const api = fakeApi({ latest });

    const restored = await loadManagedFurnitureLayout(room, 7, storage, api, browser);

    expect(restored).not.toBeNull();
    expect(api.getLatestConfirmedLayout).toHaveBeenCalledWith(7);
    expect(api.getRoomLayout).not.toHaveBeenCalled();
  });

  it("recovers stale confirmed evidence only after the Room remains readable", async () => {
    const room = createRoom("api-room-45");
    const storage = selectedRoomStorage(room, 45);
    const browser = setupBrowserStorage(room.id, 45, "stale-reedit", "REEDIT");
    markConfirmed(storage, room);
    const api = fakeApi({ room, latest: null });

    const restored = await loadManagedFurnitureLayout(room, 45, storage, api, browser);

    expect(restored).toEqual(room);
    expect(api.getLatestConfirmedLayout).toHaveBeenCalledWith(45);
    expect(api.getRoomLayout).toHaveBeenCalledWith(45);
    expect(readActiveLayoutEditingSession(storage)).toBeNull();
    expect(JSON.parse(storage.getItem("roomfit:confirmedLayoutsByRoomId") ?? "{}")[room.id]).toBeUndefined();
    expect(JSON.parse(browser.getItem("roomfit:roomSetupSession") ?? "null")).toMatchObject({
      roomLayoutId: room.id,
      backendRoomId: 45,
      mode: "NEW",
    });
  });

  it("does not recover a stale re-edit when the Room is not readable in the current scope", async () => {
    const room = createRoom("api-room-46");
    const storage = selectedRoomStorage(room, 46);
    const browser = setupBrowserStorage(room.id, 46, "wrong-scope-reedit", "REEDIT");
    markConfirmed(storage, room);
    const api = fakeApi({ latest: null });
    vi.mocked(api.getRoomLayout).mockRejectedValueOnce(new Error("ROOM_NOT_FOUND"));

    await expect(loadManagedFurnitureLayout(room, 46, storage, api, browser))
      .rejects.toThrow("ROOM_NOT_FOUND");

    expect(JSON.parse(storage.getItem("roomfit:confirmedLayoutsByRoomId") ?? "{}")[room.id]).toBeDefined();
    expect(JSON.parse(browser.getItem("roomfit:roomSetupSession") ?? "null").mode).toBe("REEDIT");
  });

  it("preserves move, rotation, and deletion through every intermediate route", async () => {
    const editedRoom = createRoom("api-room-1", -0.8, Math.PI / 2);
    editedRoom.furniture[1].status = "deleted";
    const storage = selectedRoomStorage(editedRoom);
    const browser = setupBrowserStorage(editedRoom.id, 1, "preserve-reedit", "REEDIT");
    markConfirmed(storage, editedRoom);
    const confirmed = response(10, true, null);
    const draft = response(11, false, 10);
    const saved = response(11, false, 10, backendFurnitureFromRoom(editedRoom));
    const api = fakeApi({ latest: confirmed, draft, saved, active: saved });

    const manageState = await prepareManagedFurnitureDraft(storage, api, browser);
    const preferenceState = await refreshActiveDraftNavigationState(storage, api);
    const referenceState = await refreshActiveDraftNavigationState(storage, api);
    const addFurnitureState = await prepareAdditionalFurnitureForEditor(storage, api);

    for (const state of [manageState, preferenceState, referenceState, addFurnitureState]) {
      expect(state).toMatchObject({
        roomId: 1,
        roomLayoutId: "api-room-1",
        sourceLayoutId: 10,
        activeLayoutId: 11,
        editingMode: "REEDIT_DRAFT",
      });
    }
    expect(api.addFurnitureToDraft).not.toHaveBeenCalled();
    expect(addFurnitureState?.roomLayout?.furniture[0].position.x).toBe(-0.8);
    expectEquivalentRotation(addFurnitureState?.roomLayout?.furniture[0].rotationY, Math.PI / 2);
    expect(addFurnitureState?.roomLayout?.furniture[1].status).toBe("deleted");
    expect(resolveEditorInitialRoomLayout({
      navigationState: addFurnitureState,
      activeSession: readActiveLayoutEditingSession(storage),
      selectedRoomLayout: readRoom(storage),
      liveMirror: createRoom("api-room-1", 0.9, 0),
    })).toEqual(addFurnitureState?.roomLayout);
  });

  it("creates a Draft only after the confirmed source and saves the full latest snapshot", async () => {
    const storage = selectedRoomStorage(createRoom("api-room-1", -0.8, Math.PI / 2));
    storage.setItem("roomfit:confirmedRoomLayout", JSON.stringify(createRoom("api-room-1", 0.9, 0)));
    const browser = setupBrowserStorage("api-room-1", 1, "confirmed-source", "REEDIT");
    markConfirmed(storage, createRoom("api-room-1"));
    const api = fakeApi({
      latest: response(10, true, null),
      draft: response(11, false, 10),
      saved: response(11, false, 10, backendFurniture(-0.8, Math.PI / 2)),
    });

    const result = await prepareManagedFurnitureDraft(storage, api, browser);

    expect(result?.activeLayoutId).toBe(11);
    expect(api.createLayoutDraft).toHaveBeenCalledWith(10);
    const [updatedId, fullRoom] = vi.mocked(api.updateLayout).mock.calls[0];
    expect(updatedId).toBe(11);
    expect(fullRoom.furniture.map((item) => item.id)).toEqual(["bed-1", "desk-1"]);
    expect(fullRoom.furniture[0].position).toEqual({ x: -0.8, z: 0 });
    expect(fullRoom.furniture[0].rotationY).toBe(Math.PI / 2);
    expect(readActiveLayoutEditingSession(storage)).toMatchObject({
      activeLayoutId: 11,
      sourceLayoutId: 10,
      editingMode: "REEDIT_DRAFT",
      confirmed: false,
    });
    expect(JSON.parse(storage.getItem("roomfit:confirmedRoomLayout") ?? "null").furniture[0].position.x).toBe(0.9);
  });

  it("reuses an existing unconfirmed Draft and keeps the original source ID", async () => {
    const storage = selectedRoomStorage(createRoom());
    saveDraftSession(storage, 21, 10);
    const childResponse = response(21, false, 20);
    const api = fakeApi({ active: childResponse, saved: childResponse });

    const result = await prepareManagedFurnitureDraft(storage, api);

    expect(result?.activeLayoutId).toBe(21);
    expect(result?.sourceLayoutId).toBe(10);
    expect(api.createLayoutDraft).not.toHaveBeenCalled();
    expect(api.updateLayout).toHaveBeenCalledWith(21, expect.any(Object));
  });

  it("does not navigate or overwrite recovery mirrors when Draft update fails", async () => {
    const room = createRoom("api-room-1", -0.7, Math.PI / 2);
    const storage = selectedRoomStorage(room);
    storage.setItem("roomfit:confirmedRoomLayout", JSON.stringify(createRoom("api-room-1", 0.9, 0)));
    const browser = setupBrowserStorage(room.id, 1, "failed-reedit", "REEDIT");
    markConfirmed(storage, room);
    const api = fakeApi({ latest: response(10, true, null), draft: response(11, false, 10) });
    vi.mocked(api.updateLayout).mockRejectedValueOnce(new Error("network"));

    await expect(prepareManagedFurnitureDraft(storage, api, browser)).rejects.toThrow("network");

    expect(readRoom(storage)?.furniture[0].position.x).toBe(-0.7);
    expect(JSON.parse(storage.getItem("roomfit:confirmedRoomLayout") ?? "null").furniture[0].position.x).toBe(0.9);
    expect(readActiveLayoutEditingSession(storage)?.activeLayoutId).toBe(11);
  });

  it("keeps the Draft byte-for-byte unchanged when Add Furniture has no selection", async () => {
    const room = createRoom("api-room-1", -0.65, Math.PI / 2);
    const storage = selectedRoomStorage(room);
    saveDraftSession(storage, 11, 10);
    const active = response(11, false, 10, backendFurnitureFromRoom(room));
    const api = fakeApi({ active });

    const before = JSON.stringify(active.recommendedFurniture);
    const result = await prepareAdditionalFurnitureForEditor(storage, api);

    expect(JSON.stringify(result?.layoutResponse?.recommendedFurniture)).toBe(before);
    expect(api.createDefaultAgentContext).not.toHaveBeenCalled();
    expect(api.addFurnitureToDraft).not.toHaveBeenCalled();
  });

  it("adds only selected missing furniture while preserving existing Draft coordinates", async () => {
    const room = createRoom("api-room-1", -0.6, Math.PI / 2);
    const storage = selectedRoomStorage(room);
    storage.setItem("roomfit:selectedAdditionalFurnitureIds", JSON.stringify(["mood-light"]));
    saveDraftSession(storage, 11, 10);
    const active = response(11, false, 10, backendFurnitureFromRoom(room));
    const addedItems = [...active.recommendedFurniture, backendItem("lamp-rec-1", "lamp", 1.1, 0.5, 0)];
    const added = response(11, false, 10, addedItems);
    const api = fakeApi({ active, added });

    const result = await prepareAdditionalFurnitureForEditor(storage, api);

    expect(api.createDefaultAgentContext).toHaveBeenCalledWith(1);
    expect(api.addFurnitureToDraft).toHaveBeenCalledWith(11, { contextId: 51 });
    expect(result?.roomLayout?.furniture.map((item) => item.id)).toEqual(["bed-1", "desk-1", "lamp-rec-1"]);
    expect(result?.roomLayout?.furniture[0].position.x).toBeCloseTo(-0.6);
    expectEquivalentRotation(result?.roomLayout?.furniture[0].rotationY, Math.PI / 2);
  });

  it("keeps the existing Draft intact when additive placement fails", async () => {
    const room = createRoom("api-room-1", -0.6, Math.PI / 2);
    const storage = selectedRoomStorage(room);
    storage.setItem("roomfit:selectedAdditionalFurnitureIds", JSON.stringify(["mood-light"]));
    saveDraftSession(storage, 11, 10);
    const active = response(11, false, 10, backendFurnitureFromRoom(room));
    const api = fakeApi({ active });
    vi.mocked(api.addFurnitureToDraft).mockRejectedValueOnce(new Error("no placement"));

    await expect(prepareAdditionalFurnitureForEditor(storage, api)).rejects.toThrow("no placement");

    expect(readRoom(storage)?.furniture.map((item) => item.id)).toEqual(["bed-1", "desk-1"]);
    expect(readRoom(storage)?.furniture[0].position.x).toBeCloseTo(-0.6);
    expect(readActiveLayoutEditingSession(storage)?.activeLayoutId).toBe(11);
  });

  it("uses Backend Draft over both stale selected and confirmed mirrors after refresh", async () => {
    const storage = selectedRoomStorage(createRoom("api-room-1", 0.8, 0));
    storage.setItem("roomfit:confirmedRoomLayout", JSON.stringify(createRoom("api-room-1", 0.9, 0)));
    saveDraftSession(storage, 42, 40);
    const active = response(42, false, 40, backendFurniture(-0.4, Math.PI / 2));
    const api = fakeApi({ active });

    expect(resolveEditorInitialRoomLayout({
      navigationState: null,
      activeSession: readActiveLayoutEditingSession(storage),
      selectedRoomLayout: readRoom(storage),
      liveMirror: createRoom("api-room-1", 0.9, 0),
    })).toBeNull();

    const recovered = await refreshActiveDraftNavigationState(storage, api);
    expect(recovered?.roomLayout?.furniture[0].position.x).toBeCloseTo(-0.4);
    expectEquivalentRotation(recovered?.roomLayout?.furniture[0].rotationY, Math.PI / 2);
  });

  it("does not expose Room A Draft while Room B is selected and recovers A on return", async () => {
    const roomA = createRoom("api-room-a", -0.4, Math.PI / 2);
    const storage = selectedRoomStorage(roomA, 1);
    saveDraftSession(storage, 31, 30, roomA.id, 1);
    const api = fakeApi({ active: response(31, false, 30, backendFurnitureFromRoom(roomA), 1) });

    const roomB = createRoom("api-room-b", 0.6, 0);
    selectRoom(storage, roomB, 2);
    vi.mocked(api.getLatestConfirmedLayout).mockResolvedValueOnce(null);
    const roomBState = await refreshActiveDraftNavigationState(storage, api);
    expect(roomBState).toMatchObject({ roomId: 2, roomLayoutId: "api-room-b", editingMode: "INITIAL_SETUP" });
    expect(api.getLayout).not.toHaveBeenCalled();

    selectRoom(storage, roomA, 1);
    const roomAState = await refreshActiveDraftNavigationState(storage, api);
    expect(roomAState?.activeLayoutId).toBe(31);
    expect(roomAState?.roomLayout?.furniture[0].position.x).toBeCloseTo(-0.4);
  });

  it("keeps INITIAL_SETUP separate when no confirmed Layout exists", async () => {
    const storage = selectedRoomStorage(createRoom());
    const api = fakeApi({ latest: null });

    const result = await prepareManagedFurnitureDraft(storage, api);

    expect(result).toMatchObject({
      activeLayoutId: null,
      sourceLayoutId: null,
      editingMode: "INITIAL_SETUP",
    });
    expect(api.createLayoutDraft).not.toHaveBeenCalled();
    expect(api.updateLayout).not.toHaveBeenCalled();
  });

  it("enters initial setup without probing a Layout endpoint for a new Room", async () => {
    const room = createRoom("api-room-44");
    const storage = selectedRoomStorage(room, 44);
    const browser = setupBrowserStorage(room.id, 44, "no-layout-setup");
    const api = fakeApi();

    const result = await prepareManagedFurnitureDraft(storage, api, browser);

    expect(result).toMatchObject({
      roomId: 44,
      roomLayoutId: room.id,
      activeLayoutId: null,
      sourceLayoutId: null,
      editingMode: "INITIAL_SETUP",
    });
    expect(api.getLayout).not.toHaveBeenCalled();
    expect(api.getLatestConfirmedLayout).not.toHaveBeenCalled();
    expect(api.getRoomLayout).not.toHaveBeenCalled();
  });

  it("creates and persists an initial Layout before navigating to Editor", async () => {
    const room = createRoom();
    const storage = selectedRoomStorage(room);
    const browser = setupBrowserStorage(room.id, 1, "setup-success");
    const recommendation = recommendationResponse(51, "SUCCESS");
    const api = fakeApi({ latest: null, recommendation });

    const result = await prepareAdditionalFurnitureForEditor(storage, api, browser);

    expect(api.createDefaultAgentContext).toHaveBeenCalledWith(1);
    expect(api.recommendLayout).toHaveBeenCalledWith(1, 51);
    expect(result?.activeLayoutId).toBe(51);
    expect(result?.roomLayout?.furniture.map((item) => item.id)).toEqual(["bed-1", "desk-1"]);
    expect(readActiveLayoutEditingSession(storage)).toMatchObject({
      activeLayoutId: 51,
      editingMode: "INITIAL_SETUP",
    });
  });

  it("keeps the legacy recommendation success flow when additive fields are absent", async () => {
    const room = createRoom();
    const storage = selectedRoomStorage(room);
    const legacy = response(54, false, null) as LayoutRecommendationResponse;
    const api = fakeApi({ latest: null, recommendation: legacy });

    const result = await prepareAdditionalFurnitureForEditor(storage, api, new MemoryStorage());

    expect(result?.activeLayoutId).toBe(54);
    expect(readActiveLayoutEditingSession(storage)?.activeLayoutId).toBe(54);
  });

  it("leaves explicit scripted scenarios on the existing local Editor path", async () => {
    const room = createRoom();
    const storage = selectedRoomStorage(room);
    storage.setItem("roomfit:selectedPurpose", "rest");
    storage.setItem("roomfit:selectedStyle", "natural");
    storage.setItem("roomfit:selectedPalette", "brown");
    const api = fakeApi({ latest: null });

    const result = await prepareAdditionalFurnitureForEditor(storage, api, new MemoryStorage());

    expect(result?.activeLayoutId).toBeNull();
    expect(api.createDefaultAgentContext).not.toHaveBeenCalled();
    expect(api.recommendLayout).not.toHaveBeenCalled();
  });

  it("persists PARTIAL_SUCCESS details for the same setup and applies placed furniture", async () => {
    const room = createRoom();
    const storage = selectedRoomStorage(room);
    const browser = setupBrowserStorage(room.id, 1, "setup-partial");
    const recommendation = recommendationResponse(52, "PARTIAL_SUCCESS", {
      requestedFurnitureCount: 3,
      placedFurnitureCount: 2,
      unplacedFurniture: [{
        requestIndex: 2,
        furnitureType: "sofa",
        productId: "sofa-01",
        variantId: null,
        reasonCode: "COLLISION_DETECTED",
        message: "소파가 다른 가구와 충돌합니다.",
      }],
      warningCode: "INSUFFICIENT_ROOM_SPACE",
      message: "일부 가구만 배치했습니다.",
    });
    const api = fakeApi({ latest: null, recommendation });

    const result = await prepareAdditionalFurnitureForEditor(storage, api, browser);

    expect(result?.activeLayoutId).toBe(52);
    expect(readRecommendationResult({
      sessionId: "setup-partial",
      roomLayoutId: room.id,
      backendRoomId: 1,
    }, browser)).toMatchObject({
      status: "PARTIAL_SUCCESS",
      requestedFurnitureCount: 3,
      placedFurnitureCount: 2,
      warningCode: "INSUFFICIENT_ROOM_SPACE",
    });
  });

  it("keeps selections and Layout state intact on FAILED, then allows retry", async () => {
    const room = createRoom();
    const storage = selectedRoomStorage(room);
    storage.setItem("roomfit:selectedAdditionalFurnitureIds", JSON.stringify(["bed", "sofa"]));
    const browser = setupBrowserStorage(room.id, 1, "setup-retry");
    const failed = recommendationResponse(null, "FAILED", {
      requestedFurnitureCount: 2,
      placedFurnitureCount: 0,
      unplacedFurniture: [{
        requestIndex: 0,
        furnitureType: "bed",
        reasonCode: "NO_VALID_BOUNDARY_PLACEMENT",
        message: "침대를 방 경계 안에 배치할 수 없습니다.",
      }],
      warningCode: "INSUFFICIENT_ROOM_SPACE",
      message: "공간이 부족합니다.",
    });
    const api = fakeApi({ latest: null, recommendation: failed });
    const before = storage.getItem("roomfit:selectedRoomLayout");

    await expect(prepareAdditionalFurnitureForEditor(storage, api, browser))
      .rejects.toBeInstanceOf(RecommendationFeasibilityError);

    expect(storage.getItem("roomfit:selectedRoomLayout")).toBe(before);
    expect(storage.getItem("roomfit:selectedAdditionalFurnitureIds")).toBe('["bed","sofa"]');
    expect(readActiveLayoutEditingSession(storage)).toBeNull();

    vi.mocked(api.recommendLayout).mockResolvedValueOnce(recommendationResponse(53, "SUCCESS"));
    storage.setItem("roomfit:selectedAdditionalFurnitureIds", JSON.stringify(["bed"]));
    const retried = await prepareAdditionalFurnitureForEditor(storage, api, browser);

    expect(retried?.activeLayoutId).toBe(53);
    expect(api.recommendLayout).toHaveBeenCalledTimes(2);
    expect(readRecommendationResult({
      sessionId: "setup-retry",
      roomLayoutId: room.id,
      backendRoomId: 1,
    }, browser)).toBeNull();
  });

  it("does not overwrite an unrelated active Layout ID with a FAILED response", async () => {
    const room = createRoom("api-room-2");
    const storage = selectedRoomStorage(room, 2);
    saveDraftSession(storage, 88, 80, "api-room-1", 1);
    const browser = setupBrowserStorage(room.id, 2, "setup-room-2");
    const api = fakeApi({
      latest: null,
      recommendation: recommendationResponse(null, "FAILED", { roomId: 2 }),
    });

    await expect(prepareAdditionalFurnitureForEditor(storage, api, browser))
      .rejects.toBeInstanceOf(RecommendationFeasibilityError);

    expect(readActiveLayoutEditingSession(storage)?.activeLayoutId).toBe(88);
  });

  it("keeps the last partial Layout when a revised selection returns FAILED", async () => {
    const room = createRoom();
    const storage = selectedRoomStorage(room);
    const browser = setupBrowserStorage(room.id, 1, "setup-partial-retry");
    const api = fakeApi({
      latest: null,
      recommendation: recommendationResponse(61, "PARTIAL_SUCCESS", {
        requestedFurnitureCount: 2,
        placedFurnitureCount: 1,
      }),
    });
    const partial = await prepareAdditionalFurnitureForEditor(storage, api, browser);
    const partialMirror = storage.getItem("roomfit:selectedRoomLayout");
    expect(partial?.activeLayoutId).toBe(61);

    vi.mocked(api.getLayout).mockResolvedValueOnce({
      ...response(61, false, null),
      recommendationStatus: "PARTIAL_SUCCESS",
    });
    vi.mocked(api.recommendLayout).mockResolvedValueOnce(recommendationResponse(null, "FAILED"));

    await expect(prepareAdditionalFurnitureForEditor(storage, api, browser))
      .rejects.toBeInstanceOf(RecommendationFeasibilityError);

    expect(readActiveLayoutEditingSession(storage)?.activeLayoutId).toBe(61);
    expect(storage.getItem("roomfit:selectedRoomLayout")).toBe(partialMirror);
  });

  it("keeps a transport failure distinct from a normal feasibility result", async () => {
    const room = createRoom();
    const storage = selectedRoomStorage(room);
    const browser = setupBrowserStorage(room.id, 1, "setup-network");
    const api = fakeApi({ latest: null });
    vi.mocked(api.recommendLayout).mockRejectedValueOnce(new Error("network unavailable"));

    await expect(prepareAdditionalFurnitureForEditor(storage, api, browser))
      .rejects.toThrow("network unavailable");

    expect(readRecommendationResult({
      sessionId: "setup-network",
      roomLayoutId: room.id,
      backendRoomId: 1,
    }, browser)).toBeNull();
    expect(readActiveLayoutEditingSession(storage)).toBeNull();
  });

  it("serializes every ID, center-origin pose, and DELETED status", () => {
    const room = createRoom("api-room-1", -0.8, Math.PI / 2);
    room.furniture[0].status = "user_modified";
    room.furniture[1].status = "deleted";

    const request = room.furniture.map((item) => toFurniturePositionRequest(room, item));

    expect(request.map((item) => item.id)).toEqual(["bed-1", "desk-1"]);
    expect(request[0]).toEqual({
      id: "bed-1",
      position: { x: 1.2, z: 1.5 },
      rotation: 270,
      status: "USER_MODIFIED",
    });
    expect(request[1].status).toBe("DELETED");
  });

  it("confirms only the active Draft and clears the editing session only after success", async () => {
    const room = createRoom();
    const storage = selectedRoomStorage(room);
    saveDraftSession(storage, 31, 10);
    const draft = response(31, false, 10);
    const api = fakeApi({ active: draft, saved: draft });

    await confirmActiveLayout(room, storage, api);

    expect(api.updateLayout).toHaveBeenCalledWith(31, expect.any(Object));
    expect(api.confirmLayout).toHaveBeenCalledWith(31);
    expect(readActiveLayoutEditingSession(storage)).toBeNull();

    saveDraftSession(storage, 32, 10);
    vi.mocked(api.updateLayout).mockResolvedValueOnce(response(32, false, 10));
    vi.mocked(api.confirmLayout).mockRejectedValueOnce(new Error("confirm failed"));
    await expect(confirmActiveLayout(room, storage, api)).rejects.toThrow("confirm failed");
    expect(readActiveLayoutEditingSession(storage)?.activeLayoutId).toBe(32);
  });
});

function selectedRoomStorage(room: RoomLayout, backendRoomId = 1): MemoryStorage {
  const storage = new MemoryStorage();
  selectRoom(storage, room, backendRoomId);
  return storage;
}

function markConfirmed(storage: MemoryStorage, room: RoomLayout): void {
  storage.setItem("roomfit:confirmedLayoutsByRoomId", JSON.stringify({ [room.id]: room }));
}

function setupBrowserStorage(
  roomLayoutId: string,
  backendRoomId: number,
  sessionId: string,
  mode: "NEW" | "REEDIT" = "NEW",
): MemoryStorage {
  const storage = new MemoryStorage();
  storage.setItem("roomfit:roomSetupSession", JSON.stringify({
    version: 1,
    sessionId,
    roomLayoutId,
    backendRoomId,
    mode,
    createdAt: "2026-07-18T10:00:00.000Z",
  }));
  return storage;
}

function selectRoom(storage: MemoryStorage, room: RoomLayout, backendRoomId: number): void {
  storage.setItem("roomfit:selectedRoomId", room.id);
  storage.setItem("roomfit:backendRoomId", String(backendRoomId));
  storage.setItem("roomfit:selectedRoomLayout", JSON.stringify(room));
}

function saveDraftSession(
  storage: MemoryStorage,
  activeLayoutId: number,
  sourceLayoutId: number,
  roomLayoutId = "api-room-1",
  backendRoomId = 1,
): void {
  saveActiveLayoutEditingSession({
    roomLayoutId,
    backendRoomId,
    activeLayoutId,
    sourceLayoutId,
    editingMode: "REEDIT_DRAFT",
    confirmed: false,
  }, storage);
}

function readRoom(storage: MemoryStorage): RoomLayout | null {
  const raw = storage.getItem("roomfit:selectedRoomLayout");
  return raw ? JSON.parse(raw) as RoomLayout : null;
}

function createRoom(id = "api-room-1", x = -0.5, rotationY = 0): RoomLayout {
  return {
    id,
    name: "재편집 방",
    width: 4,
    depth: 3,
    walls: [],
    doors: [],
    windows: [],
    furniture: [
      furniture("bed-1", "bed", x, rotationY),
      furniture("desk-1", "desk", 0.7, 0),
    ],
  };
}

function furniture(id: string, category: Furniture["category"], x: number, rotationY: number): Furniture {
  return {
    id,
    name: id,
    category,
    productId: `${category}-product`,
    variantId: category === "desk" ? "desk-compact" : null,
    styleTags: ["minimal"],
    dimensions: { width: 0.5, depth: 0.5, height: 0.7 },
    position: { x, z: 0 },
    rotationY,
    color: "#fff",
    material: "wood",
    status: "user_modified",
    removable: true,
  };
}

function backendFurniture(x: number, rotationY: number): BackendFurnitureApiItem[] {
  return backendFurnitureFromRoom(createRoom("api-room-1", x, rotationY));
}

function backendFurnitureFromRoom(room: RoomLayout): BackendFurnitureApiItem[] {
  return room.furniture.map((item) => backendItem(
    item.id,
    item.category,
    item.position.x + room.width / 2,
    item.position.z + room.depth / 2,
    ((-item.rotationY * 180) / Math.PI + 360) % 360,
    item,
  ));
}

function expectEquivalentRotation(actual: number | undefined, expected: number): void {
  expect(actual).toBeDefined();
  const fullTurn = Math.PI * 2;
  const difference = ((((actual as number) - expected) % fullTurn) + fullTurn) % fullTurn;
  expect(Math.min(difference, fullTurn - difference)).toBeCloseTo(0);
}

function backendItem(
  id: string,
  type: string,
  x: number,
  z: number,
  rotation: number,
  source?: Furniture,
): BackendFurnitureApiItem {
  return {
    id,
    type,
    label: source?.name ?? id,
    width: source?.dimensions.width ?? 0.25,
    depth: source?.dimensions.depth ?? 0.25,
    height: source?.dimensions.height ?? 1.4,
    position: { x, z },
    rotation,
    status: source?.status === "deleted" ? "DELETED" : "USER_MODIFIED",
    productId: source?.productId ?? null,
    variantId: source?.variantId ?? null,
    styleTags: source?.styleTags ?? [],
  };
}

function response(
  layoutId: number,
  confirmed: boolean,
  sourceLayoutId: number | null,
  items = backendFurniture(-0.5, 0),
  roomId = 1,
): LayoutResponse {
  return {
    layoutId,
    roomId,
    sourceLayoutId,
    confirmed,
    confirmedAt: confirmed ? "2026-07-18T10:00:00" : null,
    status: "SUCCESS",
    recommendedFurniture: items,
    scoreSummary: {
      collisionScore: 100,
      boundaryScore: 100,
      doorWindowScore: 100,
      pathScore: 100,
      goalScore: 100,
      styleScore: 100,
      totalScore: 100,
    },
    validationResult: {
      collisionFree: true,
      boundaryValid: true,
      doorClearance: true,
      windowClearance: true,
      pathSecured: true,
      warnings: [],
    },
  };
}

function fakeApi({
  room = createRoom(),
  latest = null,
  active = response(11, false, 10),
  draft = response(11, false, 10),
  saved = response(11, false, 10),
  added = response(11, false, 10),
  recommendation = recommendationResponse(51, "SUCCESS"),
}: {
  room?: RoomLayout;
  latest?: LayoutResponse | null;
  active?: LayoutResponse;
  draft?: LayoutResponse;
  saved?: LayoutResponse;
  added?: LayoutResponse;
  recommendation?: LayoutRecommendationResponse;
} = {}): LayoutWorkflowApi {
  return {
    getRoomLayout: vi.fn().mockResolvedValue(room),
    getLayout: vi.fn().mockResolvedValue(active),
    getLatestConfirmedLayout: vi.fn().mockResolvedValue(latest),
    createLayoutDraft: vi.fn().mockResolvedValue(draft),
    updateLayout: vi.fn().mockResolvedValue(saved),
    addFurnitureToDraft: vi.fn().mockResolvedValue(added),
    createDefaultAgentContext: vi.fn().mockResolvedValue({
      contextId: 51,
      roomId: 1,
      lifestyleGoal: "STUDY_FOCUSED",
      designStyle: ["MINIMAL"],
      requiredItems: ["lamp"],
      optionalItems: [],
      selectedImageIds: [1],
      selectedProductIds: [],
      styleTags: [],
      preferredColorTone: null,
    }),
    recommendLayout: vi.fn().mockResolvedValue(recommendation),
    confirmLayout: vi.fn().mockResolvedValue({
      layoutId: saved.layoutId,
      confirmed: true,
      confirmedAt: "2026-07-18T11:00:00",
    }),
  };
}

function recommendationResponse(
  layoutId: number | null,
  recommendationStatus: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED",
  overrides: Partial<LayoutRecommendationResponse> = {},
): LayoutRecommendationResponse {
  return {
    ...response(layoutId ?? 1, false, null),
    layoutId,
    recommendationStatus,
    requestedFurnitureCount: 2,
    placedFurnitureCount: recommendationStatus === "FAILED" ? 0 : 2,
    unplacedFurniture: [],
    ...overrides,
  };
}
