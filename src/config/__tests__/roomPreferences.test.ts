import { describe, expect, it } from "vitest";
import {
  applyPreferencesToStorage,
  getRoomPreferences,
  getRoomPreferredColorTone,
  hasRoomPreferences,
  normalizeRoomPreferences,
  saveRoomPreferences,
  shouldClearInitialPreferences,
} from "../roomPreferences";
import { readPreferredColorTone } from "../preferredColorTone";

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

  it("resolves each selected room's own preferred color tone", () => {
    const storage = new MemoryStorage();
    saveRoomPreferences("room-blue", {
      purpose: "work",
      palette: "blue",
      style: "modern",
      additionalFurnitureIds: ["desk"],
    }, storage);
    saveRoomPreferences("room-brown", {
      purpose: "rest",
      palette: "brown",
      style: "natural",
      additionalFurnitureIds: ["bed"],
    }, storage);

    expect(getRoomPreferredColorTone("room-blue", storage)).toBe("blue");
    expect(getRoomPreferredColorTone("room-brown", storage)).toBe("brown");
  });

  it("uses the original material path when a room has no preference", () => {
    expect(getRoomPreferredColorTone("room-without-preferences", new MemoryStorage())).toBeNull();
  });

  it("uses the original material path for an invalid stored palette", () => {
    const storage = new MemoryStorage();
    seedRoomPreferences(storage, {
      "room-invalid": {
        purpose: "work",
        palette: "purple",
        style: "modern",
        additionalFurnitureIds: ["desk"],
      },
    });

    expect(getRoomPreferredColorTone("room-invalid", storage)).toBeNull();
  });

  it("keeps the selected room ID while restoring its live preferences", () => {
    const storage = new MemoryStorage();
    storage.setItem("roomfit:selectedRoomId", "room-blue");
    saveRoomPreferences("room-blue", {
      purpose: "work",
      palette: "blue",
      style: "modern",
      additionalFurnitureIds: ["desk"],
    }, storage);

    applyPreferencesToStorage(getRoomPreferences("room-blue", storage), storage);

    expect(storage.getItem("roomfit:selectedRoomId")).toBe("room-blue");
    expect(getRoomPreferredColorTone(storage.getItem("roomfit:selectedRoomId") ?? "", storage)).toBe("blue");
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

  it("restores the same palette into the live room preference boundary", () => {
    const storage = new MemoryStorage();
    saveRoomPreferences("room-a", {
      purpose: "work",
      palette: "brown",
      style: "modern",
      additionalFurnitureIds: ["desk"],
    }, storage);

    applyPreferencesToStorage(getRoomPreferences("room-a", storage), storage);

    expect(readPreferredColorTone(storage)).toBe("brown");
  });

  it("clears only a new first visit, not a restored room or later revisit", () => {
    expect(shouldClearInitialPreferences(false, false)).toBe(true);
    expect(shouldClearInitialPreferences(false, true)).toBe(false);
    expect(shouldClearInitialPreferences(true, false)).toBe(false);
    expect(shouldClearInitialPreferences(true, true)).toBe(false);
  });
});
