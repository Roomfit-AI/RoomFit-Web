import { apiClient } from "./client";
import type { Furniture, FurnitureCategory, FurnitureStatus, RoomLayout, WallSegment } from "../types";

export interface SampleRoomApiItem {
  roomId: number;
  name: string;
  room: {
    width: number;
    depth: number;
    height: number;
    unit: string;
  };
  openings: Array<{
    id: string;
    type: "door" | "window" | string;
    wall: "north" | "east" | "south" | "west" | string;
    offset: number;
    width: number;
    height: number;
    sillHeight: number;
  }>;
  furniture: Array<{
    id: string;
    type: string;
    label: string;
    width: number;
    depth: number;
    height: number;
    position: {
      x: number;
      z: number;
    };
    rotation: number;
    status: "EXISTING" | "RECOMMENDED" | string;
    productId: string;
    styleTags: string[];
  }>;
  source: string;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  } | null;
}

export interface SampleRoomCard {
  title: string;
  size: string;
  tone: string;
  category: string;
  layoutId: string;
  layout: RoomLayout;
}

export async function getSampleRooms(): Promise<SampleRoomCard[]> {
  const response = await apiClient.get<ApiResponse<SampleRoomApiItem[]>>("/api/rooms/samples");
  return response.data.data.map(toSampleRoomCard);
}

function toSampleRoomCard(item: SampleRoomApiItem, index: number): SampleRoomCard {
  const layout = toRoomLayout(item);

  return {
    title: item.name || `샘플 원룸 ${index + 1}`,
    size: `${Math.round(item.room.width * item.room.depth)}㎡`,
    tone: ["white", "wood", "cream", "bright", "deep"][index % 5],
    category: "원룸",
    layoutId: layout.id,
    layout,
  };
}

function toRoomLayout(item: SampleRoomApiItem): RoomLayout {
  const width = item.room.width;
  const depth = item.room.depth;
  const walls = createWalls(width, depth);
  const doorOpening = item.openings.find((opening) => opening.type === "door");
  const windowOpening = item.openings.find((opening) => opening.type === "window");

  return {
    id: `api-room-${item.roomId}`,
    name: item.name,
    description: `${item.room.width}m x ${item.room.depth}m ${item.room.unit} 샘플 방`,
    width,
    depth,
    walls,
    door: toOpening(doorOpening, "door-main", "현관", width, depth),
    window: toOpening(windowOpening, "window-main", "창문", width, depth),
    furniture: item.furniture.map(toFurniture),
  };
}

function createWalls(width: number, depth: number): WallSegment[] {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  return [
    { id: "north", start: { x: -halfWidth, z: -halfDepth }, end: { x: halfWidth, z: -halfDepth } },
    { id: "east", start: { x: halfWidth, z: -halfDepth }, end: { x: halfWidth, z: halfDepth } },
    { id: "south", start: { x: halfWidth, z: halfDepth }, end: { x: -halfWidth, z: halfDepth } },
    { id: "west", start: { x: -halfWidth, z: halfDepth }, end: { x: -halfWidth, z: -halfDepth } },
  ];
}

function toOpening(
  opening: SampleRoomApiItem["openings"][number] | undefined,
  fallbackId: string,
  label: string,
  roomWidth: number,
  roomDepth: number,
): RoomLayout["door"] {
  const normalized = opening ?? {
    id: fallbackId,
    type: label === "현관" ? "door" : "window",
    wall: label === "현관" ? "south" : "north",
    offset: label === "현관" ? roomWidth * 0.25 : roomWidth * 0.65,
    width: label === "현관" ? 0.8 : 1.4,
    height: label === "현관" ? 2.1 : 1.2,
    sillHeight: label === "현관" ? 0 : 0.9,
  };

  return {
    id: normalized.id,
    label,
    position: openingPosition(normalized.wall, normalized.offset, roomWidth, roomDepth),
    dimensions: {
      width: normalized.width,
      depth: 0.18,
      height: normalized.height,
    },
    rotationY: normalized.wall === "east" || normalized.wall === "west" ? Math.PI / 2 : 0,
  };
}

function openingPosition(wall: string, offset: number, roomWidth: number, roomDepth: number) {
  const halfWidth = roomWidth / 2;
  const halfDepth = roomDepth / 2;

  if (wall === "north") {
    return { x: -halfWidth + offset, z: -halfDepth };
  }

  if (wall === "south") {
    return { x: -halfWidth + offset, z: halfDepth };
  }

  if (wall === "east") {
    return { x: halfWidth, z: -halfDepth + offset };
  }

  return { x: -halfWidth, z: -halfDepth + offset };
}

function toFurniture(item: SampleRoomApiItem["furniture"][number]): Furniture {
  const category = toFurnitureCategory(item.type);

  return {
    id: item.id,
    name: item.label,
    category,
    dimensions: {
      width: item.width,
      depth: item.depth,
      height: item.height,
    },
    position: item.position,
    rotationY: item.rotation,
    color: colorByCategory(category),
    material: category === "desk" || category === "cabinet" ? "wood" : "fabric",
    status: toFurnitureStatus(item.status),
    removable: true,
  };
}

function toFurnitureCategory(type: string): FurnitureCategory {
  if (type === "desk" || type === "bed" || type === "chair" || type === "cabinet" || type === "rug" || type === "lighting") {
    return type;
  }

  if (type === "sofa") {
    return "chair";
  }

  if (type === "table") {
    return "desk";
  }

  if (type === "shelf" || type === "tvStand") {
    return "cabinet";
  }

  return "cabinet";
}

function toFurnitureStatus(status: string): FurnitureStatus {
  return status === "EXISTING" ? "existing" : "recommended";
}

function colorByCategory(category: FurnitureCategory): string {
  const colors: Record<FurnitureCategory, string> = {
    bed: "#f7f7f5",
    desk: "#c7a27a",
    chair: "#f2ebe2",
    cabinet: "#8a6542",
    rug: "#d8c7ad",
    lighting: "#26211d",
  };

  return colors[category];
}
