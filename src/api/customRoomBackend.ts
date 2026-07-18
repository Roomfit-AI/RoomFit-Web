import { normalizeBackendRoomId } from "./agentContextRequest";
import { uploadRoomLayout } from "./rooms";
import type { RoomLayout } from "../types";

export const CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY = "roomfit:customBackendRoomFingerprint";

type CustomRoomBackendStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface EnsureCustomRoomBackendInput {
  room: RoomLayout;
  storage?: CustomRoomBackendStorage;
  createRoom?: (room: RoomLayout) => Promise<number>;
}

export async function ensureCustomRoomBackendRoom({
  room,
  storage = localStorage,
  createRoom = uploadRoomLayout,
}: EnsureCustomRoomBackendInput): Promise<number> {
  if (room.source !== "CUSTOM") {
    throw new Error("커스텀 방만 Backend Room으로 생성할 수 있습니다.");
  }

  const fingerprint = createCustomRoomBackendFingerprint(room);
  const storedRoomId = normalizeBackendRoomId(storage.getItem("roomfit:backendRoomId"));
  const storedFingerprint = storage.getItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY);

  if (storedRoomId !== null && storedFingerprint === fingerprint) {
    return storedRoomId;
  }

  storage.removeItem("roomfit:backendRoomId");
  storage.removeItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY);

  const roomId = normalizeBackendRoomId(await createRoom(room));
  if (roomId === null) {
    throw new Error("Backend가 유효한 roomId를 반환하지 않았습니다.");
  }

  storage.setItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY, fingerprint);
  storage.setItem("roomfit:backendRoomId", String(roomId));
  return roomId;
}

export function createCustomRoomBackendFingerprint(room: RoomLayout): string {
  return JSON.stringify({
    id: room.id,
    name: room.name,
    source: room.source,
    width: room.width,
    depth: room.depth,
    height: room.height ?? 2.4,
    unit: room.unit ?? "meter",
    walls: room.walls.map((wall) => ({
      id: wall.id,
      start: wall.start,
      end: wall.end,
      height: wall.height,
      thickness: wall.thickness,
    })),
    doors: room.doors,
    windows: room.windows,
    furniture: room.furniture.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      dimensions: item.dimensions,
      position: item.position,
      rotationY: item.rotationY,
      status: item.status,
    })),
  });
}
