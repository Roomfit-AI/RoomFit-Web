import { createRectangularWalls } from "../api/rooms";
import { CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY } from "../api/customRoomBackend";
import type { RoomLayout } from "../types";

export const CUSTOM_ROOM_LAYOUT_ID = "custom-room-draft";

export interface CustomRoomCard {
  title: string;
  size: string;
  tone: string;
  category: string;
  layoutId: string;
  layout: RoomLayout;
}

export interface CustomRoomFormValues {
  name: string;
  width: string;
  depth: string;
}

export interface CustomRoomFormErrors {
  name?: string;
  width?: string;
  depth?: string;
}

export type CustomRoomResult =
  | { success: true; room: CustomRoomCard }
  | { success: false; errors: CustomRoomFormErrors };

interface RoomSelection {
  roomId?: number;
  title: string;
  size: string;
  category: string;
  layoutId: string;
  layout: RoomLayout;
}

type RoomSelectionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createCustomRoom(values: CustomRoomFormValues): CustomRoomResult {
  const name = values.name.trim();
  const width = parseDimension(values.width, "가로 길이");
  const depth = parseDimension(values.depth, "세로 길이");
  const errors: CustomRoomFormErrors = {};

  if (!name) {
    errors.name = "방 이름을 입력해 주세요.";
  }
  if (typeof width === "string") {
    errors.width = width;
  }
  if (typeof depth === "string") {
    errors.depth = depth;
  }

  if (Object.keys(errors).length > 0 || typeof width !== "number" || typeof depth !== "number") {
    return { success: false, errors };
  }

  const maxDimension = Math.max(width, depth);
  const layout: RoomLayout = {
    id: CUSTOM_ROOM_LAYOUT_ID,
    name,
    description: `${width}m x ${depth}m 직접 만든 방`,
    width,
    depth,
    height: 2.4,
    unit: "meter",
    source: "CUSTOM",
    floor: {
      size: { width, depth },
      material: { color: "#c2996a", roughness: 0.68 },
    },
    camera: {
      type: "orthographic",
      position: {
        x: maxDimension * 1.35,
        y: maxDimension * 1.08,
        z: maxDimension * 1.35,
      },
      target: { x: 0, y: 0.55, z: 0 },
      zoom: Math.max(68, 108 - maxDimension * 6),
    },
    lighting: {
      ambient: 0.78,
      sun: {
        intensity: 1.85,
        position: [3.8, 7.5, 4.6],
      },
      environment: "bright-neutral-studio",
    },
    walls: createRectangularWalls(width, depth),
    doors: [],
    windows: [],
    furniture: [],
  };

  return {
    success: true,
    room: {
      title: name,
      size: formatArea(width * depth),
      tone: "white",
      category: "직접 생성",
      layoutId: CUSTOM_ROOM_LAYOUT_ID,
      layout,
    },
  };
}

export function persistRoomSelection(
  room: RoomSelection,
  storage: RoomSelectionStorage = localStorage,
): void {
  storage.setItem("roomfit:selectedRoomId", room.layoutId);
  storage.setItem("roomfit:selectedRoomTitle", room.title);
  storage.setItem("roomfit:selectedRoomType", room.category);
  storage.setItem("roomfit:selectedRoomSize", room.size);
  storage.setItem("roomfit:selectedRoomLayout", JSON.stringify(room.layout));

  if (room.roomId === undefined) {
    storage.removeItem("roomfit:backendRoomId");
    storage.removeItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY);
  } else {
    storage.setItem("roomfit:backendRoomId", String(room.roomId));
    storage.removeItem(CUSTOM_ROOM_BACKEND_FINGERPRINT_KEY);
  }
}

export function readSelectedCustomRoom(
  storage: Pick<RoomSelectionStorage, "getItem"> = localStorage,
): CustomRoomCard | null {
  if (storage.getItem("roomfit:selectedRoomId") !== CUSTOM_ROOM_LAYOUT_ID) {
    return null;
  }

  const rawLayout = storage.getItem("roomfit:selectedRoomLayout");
  if (!rawLayout) {
    return null;
  }

  try {
    const layout: unknown = JSON.parse(rawLayout);
    if (!isCustomRoomLayout(layout)) {
      return null;
    }

    return {
      title: layout.name,
      size: formatArea(layout.width * layout.depth),
      tone: "white",
      category: "직접 생성",
      layoutId: CUSTOM_ROOM_LAYOUT_ID,
      layout,
    };
  } catch {
    return null;
  }
}

function parseDimension(value: string, label: string): number | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label}를 입력해 주세요.`;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return `${label}는 유효한 숫자여야 합니다.`;
  }
  if (parsed <= 0) {
    return `${label}는 0보다 커야 합니다.`;
  }

  return parsed;
}

function formatArea(area: number): string {
  return `${Number(area.toFixed(2))}m²`;
}

function isCustomRoomLayout(value: unknown): value is RoomLayout {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const layout = value as Partial<RoomLayout>;
  return (
    layout.id === CUSTOM_ROOM_LAYOUT_ID &&
    typeof layout.name === "string" &&
    layout.name.trim().length > 0 &&
    typeof layout.width === "number" &&
    Number.isFinite(layout.width) &&
    layout.width > 0 &&
    typeof layout.depth === "number" &&
    Number.isFinite(layout.depth) &&
    layout.depth > 0 &&
    Array.isArray(layout.walls) &&
    Array.isArray(layout.doors) &&
    Array.isArray(layout.windows) &&
    Array.isArray(layout.furniture)
  );
}
