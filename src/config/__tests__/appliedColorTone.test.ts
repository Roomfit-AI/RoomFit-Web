import { describe, expect, it } from "vitest";
import type { RoomLayout } from "../../types";
import {
  getLayoutAppliedPreferredColorTone,
  resolveRoomLayoutPreferredColorTone,
  withAppliedPreferredColorTone,
} from "../appliedColorTone";
import {
  createAppliedRoomPreferences,
  getRoomPreferredColorTone,
  readCurrentPreferences,
  saveRoomPreferences,
} from "../roomPreferences";

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

function createRoom(id = "room-blue"): RoomLayout {
  return {
    id,
    name: id,
    width: 4,
    depth: 3,
    walls: [],
    doors: [],
    windows: [],
    furniture: [],
  };
}

function saveBlueAppliedPreference(storage: MemoryStorage, roomId = "room-blue") {
  saveRoomPreferences(roomId, {
    purpose: "work",
    palette: "blue",
    style: "modern",
    additionalFurnitureIds: ["desk"],
  }, storage);
}

describe("applied preferred color tone", () => {
  it("keeps confirmed blue visible while the next request draft is brown", () => {
    const storage = new MemoryStorage();
    saveBlueAppliedPreference(storage);
    storage.setItem("roomfit:selectedPalette", "brown");

    expect(resolveRoomLayoutPreferredColorTone(createRoom(), storage)).toBe("blue");
  });

  it("promotes brown to the displayed tone only when a recommendation succeeds", () => {
    const storage = new MemoryStorage();
    saveBlueAppliedPreference(storage);
    storage.setItem("roomfit:selectedPalette", "brown");
    const currentLayout = createRoom();

    const recommendedLayout = withAppliedPreferredColorTone(
      currentLayout,
      storage.getItem("roomfit:selectedPalette"),
    );

    expect(getLayoutAppliedPreferredColorTone(recommendedLayout)).toBe("brown");
    expect(resolveRoomLayoutPreferredColorTone(recommendedLayout, storage)).toBe("brown");
    expect(getLayoutAppliedPreferredColorTone(currentLayout)).toBeNull();
  });

  it("keeps blue after a failed recommendation leaves the current layout unchanged", () => {
    const storage = new MemoryStorage();
    saveBlueAppliedPreference(storage);
    storage.setItem("roomfit:selectedPalette", "brown");
    const currentLayout = createRoom();

    expect(resolveRoomLayoutPreferredColorTone(currentLayout, storage)).toBe("blue");
    expect(getRoomPreferredColorTone(currentLayout.id, storage)).toBe("blue");
  });

  it("does not overwrite the applied room preference when leaving without generating", () => {
    const storage = new MemoryStorage();
    saveBlueAppliedPreference(storage);
    storage.setItem("roomfit:selectedPalette", "brown");

    resolveRoomLayoutPreferredColorTone(createRoom(), storage);

    expect(getRoomPreferredColorTone("room-blue", storage)).toBe("blue");
  });

  it("persists brown for confirm, thumbnail, and furniture management after success", () => {
    const storage = new MemoryStorage();
    saveBlueAppliedPreference(storage);
    storage.setItem("roomfit:selectedPalette", "brown");
    const recommendedLayout = withAppliedPreferredColorTone(createRoom(), "brown");
    const confirmedPreferences = createAppliedRoomPreferences(
      readCurrentPreferences(storage),
      resolveRoomLayoutPreferredColorTone(recommendedLayout, storage),
    );

    saveRoomPreferences(recommendedLayout.id, confirmedPreferences, storage);

    expect(getRoomPreferredColorTone(recommendedLayout.id, storage)).toBe("brown");
    expect(resolveRoomLayoutPreferredColorTone(createRoom(), storage)).toBe("brown");
  });

  it("does not mix another room's applied tone with the current draft", () => {
    const storage = new MemoryStorage();
    saveBlueAppliedPreference(storage, "room-blue");
    saveRoomPreferences("room-green", {
      purpose: "rest",
      palette: "green",
      style: "natural",
      additionalFurnitureIds: [],
    }, storage);
    storage.setItem("roomfit:selectedPalette", "brown");

    expect(resolveRoomLayoutPreferredColorTone(createRoom("room-blue"), storage)).toBe("blue");
    expect(resolveRoomLayoutPreferredColorTone(createRoom("room-green"), storage)).toBe("green");
    expect(resolveRoomLayoutPreferredColorTone(createRoom("room-new"), storage)).toBe("brown");
  });
});
