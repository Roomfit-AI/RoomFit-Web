import { describe, expect, it, vi } from "vitest";

import { toFurniturePositionRequest, type LayoutResponse } from "../../api/layouts";
import type { BackendFurnitureApiItem } from "../../api/rooms";
import type { Furniture, RoomLayout } from "../../types";
import {
  confirmActiveLayout,
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
  it("preserves move, rotation, and deletion through every intermediate route", async () => {
    const editedRoom = createRoom("api-room-1", -0.8, Math.PI / 2);
    editedRoom.furniture[1].status = "deleted";
    const storage = selectedRoomStorage(editedRoom);
    const confirmed = response(10, true, null);
    const draft = response(11, false, 10);
    const saved = response(11, false, 10, backendFurnitureFromRoom(editedRoom));
    const api = fakeApi({ latest: confirmed, draft, saved, active: saved });

    const manageState = await prepareManagedFurnitureDraft(storage, api);
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
    const api = fakeApi({
      latest: response(10, true, null),
      draft: response(11, false, 10),
      saved: response(11, false, 10, backendFurniture(-0.8, Math.PI / 2)),
    });

    const result = await prepareManagedFurnitureDraft(storage, api);

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
    const api = fakeApi({ latest: response(10, true, null), draft: response(11, false, 10) });
    vi.mocked(api.updateLayout).mockRejectedValueOnce(new Error("network"));

    await expect(prepareManagedFurnitureDraft(storage, api)).rejects.toThrow("network");

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
  latest = null,
  active = response(11, false, 10),
  draft = response(11, false, 10),
  saved = response(11, false, 10),
  added = response(11, false, 10),
}: {
  latest?: LayoutResponse | null;
  active?: LayoutResponse;
  draft?: LayoutResponse;
  saved?: LayoutResponse;
  added?: LayoutResponse;
} = {}): LayoutWorkflowApi {
  return {
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
    confirmLayout: vi.fn().mockResolvedValue({
      layoutId: saved.layoutId,
      confirmed: true,
      confirmedAt: "2026-07-18T11:00:00",
    }),
  };
}
