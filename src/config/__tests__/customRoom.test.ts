import { describe, expect, it } from "vitest";

import {
  CUSTOM_ROOM_LAYOUT_ID,
  createCustomRoom,
  persistRoomSelection,
  readSelectedCustomRoom,
} from "../customRoom";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("createCustomRoom", () => {
  it("creates an empty room with exact decimal dimensions and existing wall rules", () => {
    const result = createCustomRoom({
      name: "[TEST] LLM Feedback",
      width: "6",
      depth: "6",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.room).toMatchObject({
      title: "[TEST] LLM Feedback",
      size: "36m²",
      category: "직접 생성",
      layoutId: CUSTOM_ROOM_LAYOUT_ID,
      layout: {
        id: CUSTOM_ROOM_LAYOUT_ID,
        name: "[TEST] LLM Feedback",
        width: 6,
        depth: 6,
        source: "CUSTOM",
        doors: [],
        windows: [],
        furniture: [],
      },
    });
    expect(result.room.layout.walls).toHaveLength(4);
    expect(result.room.layout.walls[0]).toMatchObject({
      id: "north",
      start: { x: -3, z: -3 },
      end: { x: 3, z: -3 },
    });
    result.room.layout.walls.forEach((wall, index, walls) => {
      expect(wall.end).toEqual(walls[(index + 1) % walls.length].start);
    });
  });

  it("keeps decimal width and depth instead of rounding the room data", () => {
    const result = createCustomRoom({ name: "소수 방", width: "3.25", depth: "4.4" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.room.layout.width).toBe(3.25);
    expect(result.room.layout.depth).toBe(4.4);
    expect(result.room.size).toBe("14.3m²");
  });

  it.each([
    ["", "4", "width"],
    ["abc", "4", "width"],
    ["0", "4", "width"],
    ["-1", "4", "width"],
    ["Infinity", "4", "width"],
    ["4", "", "depth"],
    ["4", "NaN", "depth"],
    ["4", "0", "depth"],
    ["4", "-2", "depth"],
  ])("rejects invalid dimensions (%s x %s)", (width, depth, field) => {
    const result = createCustomRoom({ name: "테스트 방", width, depth });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[field as "width" | "depth"]).toBeTruthy();
  });

  it("rejects a blank room name", () => {
    const result = createCustomRoom({ name: "   ", width: "4", depth: "3" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.name).toBe("방 이름을 입력해 주세요.");
  });

  it("reuses one stable custom draft id when the form is applied again", () => {
    const first = createCustomRoom({ name: "첫 방", width: "4", depth: "3" });
    const edited = createCustomRoom({ name: "수정한 방", width: "5", depth: "4" });

    expect(first.success && first.room.layoutId).toBe(CUSTOM_ROOM_LAYOUT_ID);
    expect(edited.success && edited.room.layoutId).toBe(CUSTOM_ROOM_LAYOUT_ID);
  });
});

describe("persistRoomSelection", () => {
  it("removes a previous sample backend id when the custom room is selected", () => {
    const storage = new MemoryStorage();
    storage.setItem("roomfit:backendRoomId", "27");
    const result = createCustomRoom({ name: "직접 만든 방", width: "5", depth: "4" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    persistRoomSelection(result.room, storage);

    expect(storage.getItem("roomfit:backendRoomId")).toBeNull();
    expect(storage.getItem("roomfit:selectedRoomId")).toBe(CUSTOM_ROOM_LAYOUT_ID);
    expect(storage.getItem("roomfit:selectedRoomTitle")).toBe("직접 만든 방");
    expect(storage.getItem("roomfit:selectedRoomType")).toBe("직접 생성");
    expect(storage.getItem("roomfit:selectedRoomSize")).toBe("20m²");
    expect(JSON.parse(storage.getItem("roomfit:selectedRoomLayout") ?? "null")).toMatchObject({
      id: CUSTOM_ROOM_LAYOUT_ID,
      width: 5,
      depth: 4,
      furniture: [],
    });
  });

  it("keeps the existing sample selection contract", () => {
    const storage = new MemoryStorage();
    const result = createCustomRoom({ name: "샘플 대역", width: "4", depth: "3" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    persistRoomSelection({ ...result.room, roomId: 15, layoutId: "api-room-15" }, storage);

    expect(storage.getItem("roomfit:backendRoomId")).toBe("15");
    expect(storage.getItem("roomfit:selectedRoomId")).toBe("api-room-15");
  });

  it("restores the selected custom card from the existing room selection keys", () => {
    const storage = new MemoryStorage();
    const result = createCustomRoom({ name: "복원할 방", width: "4.5", depth: "3" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    persistRoomSelection(result.room, storage);

    expect(readSelectedCustomRoom(storage)).toMatchObject({
      title: "복원할 방",
      size: "13.5m²",
      layoutId: CUSTOM_ROOM_LAYOUT_ID,
      layout: { width: 4.5, depth: 3, furniture: [] },
    });
  });

  it("ignores a corrupt or non-custom selected room layout", () => {
    const storage = new MemoryStorage();
    storage.setItem("roomfit:selectedRoomId", CUSTOM_ROOM_LAYOUT_ID);
    storage.setItem("roomfit:selectedRoomLayout", "{bad json");
    expect(readSelectedCustomRoom(storage)).toBeNull();

    storage.setItem("roomfit:selectedRoomLayout", JSON.stringify({ id: "api-room-1" }));
    expect(readSelectedCustomRoom(storage)).toBeNull();
  });
});
