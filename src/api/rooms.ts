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
    sillHeight: number | null;
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
    productId: string | null;
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

export async function getSampleRoomLayouts(): Promise<RoomLayout[]> {
  const response = await apiClient.get<ApiResponse<SampleRoomApiItem[]>>("/api/rooms/samples");
  return response.data.data.map(toRoomLayout);
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
    description: `${width}m x ${depth}m ${item.room.unit} 샘플 방`,
    width,
    depth,
    height: item.room.height,
    unit: item.room.unit,
    source: item.source,
    createdAt: item.createdAt,
    floor: {
      size: { width, depth },
      material: { color: "#eee6dc", roughness: 0.86 },
    },
    camera: {
      type: "orthographic",
      position: {
        x: Math.max(width, depth) * 1.35,
        y: Math.max(width, depth) * 1.08,
        z: Math.max(width, depth) * 1.35,
      },
      target: { x: 0, y: 0.55, z: 0 },
      zoom: Math.max(68, 108 - Math.max(width, depth) * 6),
    },
    lighting: {
      ambient: 0.78,
      sun: {
        intensity: 1.85,
        position: [3.8, 7.5, 4.6],
      },
      environment: "bright-neutral-studio",
    },
    walls,
    door: toOpening(doorOpening, "door-main", "현관", width, depth),
    window: toOpening(windowOpening, "window-main", "창문", width, depth),
    furniture: item.furniture.map((furniture) => toFurniture(furniture, width, depth)),
  };
}

function createWalls(width: number, depth: number): WallSegment[] {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  return [
    createWall("north", { x: -halfWidth, z: -halfDepth }, { x: halfWidth, z: -halfDepth }),
    createWall("east", { x: halfWidth, z: -halfDepth }, { x: halfWidth, z: halfDepth }),
    createWall("south", { x: halfWidth, z: halfDepth }, { x: -halfWidth, z: halfDepth }),
    createWall("west", { x: -halfWidth, z: halfDepth }, { x: -halfWidth, z: -halfDepth }),
  ];
}

function createWall(id: string, start: { x: number; z: number }, end: { x: number; z: number }): WallSegment {
  return {
    id,
    start,
    end,
    height: 2.4,
    thickness: 0.12,
    material: {
      color: "#f6f3ee",
      roughness: 0.82,
    },
  };
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
    sillHeight: label === "현관" ? null : 0.9,
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
    frame: {
      color: "#8a623d",
    },
    glass: {
      transmission: normalized.type === "window" ? 0.28 : 0,
      opacity: normalized.type === "window" ? 0.24 : 1,
    },
    blind:
      normalized.type === "window"
        ? {
            enabled: true,
            type: "wood",
            slats: 14,
          }
        : undefined,
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

function toFurniture(
  item: SampleRoomApiItem["furniture"][number],
  roomWidth: number,
  roomDepth: number,
): Furniture {
  const category = toFurnitureCategory(item.type);
  const materialType = materialByCategory(category);
  const color = colorByCategory(category);

  return {
    id: item.id,
    name: item.label,
    category,
    geometry: geometryByType(item.type, category),
    dimensions: {
      width: item.width,
      depth: item.depth,
      height: item.height,
    },
    position: {
      x: item.position.x - roomWidth / 2,
      z: item.position.z - roomDepth / 2,
    },
    rotationY: normalizeRotation(item.rotation),
    color,
    material: {
      type: materialType,
      color,
      roughness: category === "rug" ? 0.96 : materialType === "wood" ? 0.55 : 0.9,
      metalness: materialType === "metal" ? 0.8 : 0,
    },
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

  if (type === "shelf" || type === "tvStand" || type === "storage" || type === "wardrobe") {
    return "cabinet";
  }

  return "cabinet";
}

function geometryByType(type: string, category: FurnitureCategory) {
  if (category === "rug") {
    return "plane" as const;
  }

  if (category === "lighting" || type === "table") {
    return "cylinder" as const;
  }

  if (type === "sofa") {
    return "rounded-box" as const;
  }

  return "box" as const;
}

function normalizeRotation(rotation: number): number {
  return Math.abs(rotation) > Math.PI * 2 ? (rotation * Math.PI) / 180 : rotation;
}

function toFurnitureStatus(status: string): FurnitureStatus {
  return status === "EXISTING" ? "existing" : "recommended";
}

function materialByCategory(category: FurnitureCategory) {
  if (category === "desk" || category === "cabinet") {
    return "wood" as const;
  }

  if (category === "lighting") {
    return "metal" as const;
  }

  return "fabric" as const;
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
