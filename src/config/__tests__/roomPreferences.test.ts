import { describe, expect, it } from "vitest";
import {
  getRoomPreferences,
  hasRoomPreferences,
  normalizeRoomPreferences,
  saveRoomPreferences,
  shouldClearInitialPreferences,
} from "../roomPreferences";

const ROOM_PREFERENCES_KEY = "roomfit:preferencesByRoomId";

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

function seedRoomPreferences(storage: MemoryStorage, value: unknown): void {
  storage.setItem(ROOM_PREFERENCES_KEY, JSON.stringify(value));
}

describe("roomPreferences", () => {
  it("restores a valid legacy palette and the other preference fields", () => {
    const storage = new MemoryStorage();
    seedRoomPreferences(storage, {
      "room-a": {
        purpose: "work",
        palette: "brown",
        style: "natural",
        additionalFurnitureIds: ["desk", "chair"],
      },
    });

    expect(getRoomPreferences("room-a", storage)).toEqual({
      purpose: "work",
      palette: "brown",
      style: "natural",
      additionalFurnitureIds: ["desk", "chair"],
    });
  });

  it("normalizes a missing palette from older data to no selection", () => {
    expect(normalizeRoomPreferences({
      purpose: "rest",
      style: "minimal",
      additionalFurnitureIds: ["lamp"],
    })).toEqual({
      purpose: "rest",
      palette: "",
      style: "minimal",
      additionalFurnitureIds: ["lamp"],
    });
  });

  it("normalizes an unknown palette without changing valid sibling fields", () => {
    expect(normalizeRoomPreferences({
      purpose: "hobby",
      palette: "coral-label",
      style: "midcentury",
      additionalFurnitureIds: ["desk", null, 7, "lamp"],
    })).toEqual({
      purpose: "hobby",
      palette: "",
      style: "midcentury",
      additionalFurnitureIds: ["desk", "lamp"],
    });
  });

  it("keeps room preferences isolated", () => {
    const storage = new MemoryStorage();
    saveRoomPreferences("room-a", {
      purpose: "work",
      palette: "ivory",
      style: "minimal",
      additionalFurnitureIds: ["desk"],
    }, storage);
    saveRoomPreferences("room-b", {
      purpose: "rest",
      palette: "green",
      style: "natural",
      additionalFurnitureIds: ["plant"],
    }, storage);

    expect(getRoomPreferences("room-a", storage).palette).toBe("ivory");
    expect(getRoomPreferences("room-b", storage).palette).toBe("green");
    expect(hasRoomPreferences("room-a", storage)).toBe(true);
    expect(hasRoomPreferences("missing-room", storage)).toBe(false);
  });

  it("round-trips without sharing mutable furniture ID arrays", () => {
    const storage = new MemoryStorage();
    const additionalFurnitureIds = ["desk", "chair"];

    saveRoomPreferences("room-a", {
      purpose: "work",
      palette: "blue",
      style: "modern",
      additionalFurnitureIds,
    }, storage);
    additionalFurnitureIds.push("lamp");

    const restored = getRoomPreferences("room-a", storage);
    expect(restored.additionalFurnitureIds).toEqual(["desk", "chair"]);

    restored.additionalFurnitureIds.push("storage");
    expect(getRoomPreferences("room-a", storage).additionalFurnitureIds).toEqual([
      "desk",
      "chair",
    ]);
  });

  it("clears only a new first visit, not a restored room or later revisit", () => {
    expect(shouldClearInitialPreferences(false, false)).toBe(true);
    expect(shouldClearInitialPreferences(false, true)).toBe(false);
    expect(shouldClearInitialPreferences(true, false)).toBe(false);
    expect(shouldClearInitialPreferences(true, true)).toBe(false);
  });
});
