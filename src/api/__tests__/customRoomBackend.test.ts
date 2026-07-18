import { describe, expect, it, vi } from "vitest";

import {
  CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY,
  createCustomRoomBackendFingerprint,
  ensureCustomRoomBackendRoom,
} from "../customRoomBackend";
import { createCustomRoom } from "../../config/customRoom";

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

function customRoom() {
  const result = createCustomRoom({ name: "[TEST] LLM Feedback", width: "6", depth: "6" });
  if (!result.success) throw new Error("custom room fixture 생성 실패");
  return result.room.layout;
}

describe("ensureCustomRoomBackendRoom", () => {
  it("creates a Backend Room once and stores the returned id", async () => {
    const storage = new MemoryStorage();
    const room = customRoom();
    const createRoom = vi.fn().mockResolvedValue(41);

    await expect(ensureCustomRoomBackendRoom({ room, storage, createRoom })).resolves.toBe(41);
    await expect(ensureCustomRoomBackendRoom({ room, storage, createRoom })).resolves.toBe(41);

    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(createRoom).toHaveBeenCalledWith(room);
    expect(storage.getItem("roomfit:backendRoomId")).toBe("41");
    expect(storage.getItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY)).toBe(
      createCustomRoomBackendFingerprint(room),
    );
  });

  it("invalidates a stale id and creates a new room when the snapshot changes", async () => {
    const storage = new MemoryStorage();
    const room = customRoom();
    storage.setItem("roomfit:backendRoomId", "41");
    storage.setItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY, createCustomRoomBackendFingerprint(room));
    const changedRoom = { ...room, width: 7, floor: { ...room.floor!, size: { width: 7, depth: 6 } } };
    const createRoom = vi.fn().mockResolvedValue(42);

    await expect(ensureCustomRoomBackendRoom({ room: changedRoom, storage, createRoom })).resolves.toBe(42);

    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(storage.getItem("roomfit:backendRoomId")).toBe("42");
  });

  it("keeps the draft retryable and does not retain a sample id after creation failure", async () => {
    const storage = new MemoryStorage();
    storage.setItem("roomfit:backendRoomId", "7");
    storage.setItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY, "stale");
    const createRoom = vi.fn().mockRejectedValue(new Error("network"));

    await expect(ensureCustomRoomBackendRoom({ room: customRoom(), storage, createRoom })).rejects.toThrow("network");

    expect(storage.getItem("roomfit:backendRoomId")).toBeNull();
    expect(storage.getItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY)).toBeNull();
  });
});
