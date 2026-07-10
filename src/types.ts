export type FurnitureCategory =
  | "bed"
  | "desk"
  | "chair"
  | "cabinet"
  | "rug"
  | "lighting";

export type FurnitureStatus = "existing" | "recommended";
export type FurnitureGeometry = "box" | "rounded-box" | "cylinder" | "plane" | "model";
export type FurnitureMaterialType = "fabric" | "wood" | "white" | "metal" | "glass" | "accent";

export interface MaterialConfig {
  type: FurnitureMaterialType;
  color: string;
  roughness?: number;
  metalness?: number;
}

export interface Vector2D {
  x: number;
  z: number;
}

export interface Size3D {
  width: number;
  depth: number;
  height: number;
}

export interface Furniture {
  id: string;
  name: string;
  category: FurnitureCategory;
  dimensions: Size3D;
  position: Vector2D;
  rotationY: number;
  color: string;
  geometry?: FurnitureGeometry;
  model?: string;
  material: FurnitureMaterialType | MaterialConfig;
  status: FurnitureStatus;
  removable: boolean;
}

export interface WallSegment {
  id: string;
  start: Vector2D;
  end: Vector2D;
  height?: number;
  thickness?: number;
  material?: {
    color: string;
    roughness: number;
  };
}

export interface Opening {
  id: string;
  label: string;
  position: Vector2D;
  dimensions: Size3D;
  rotationY: number;
  frame?: {
    color: string;
  };
  glass?: {
    transmission: number;
    opacity: number;
  };
  blind?: {
    enabled: boolean;
    type: "wood";
    slats: number;
  };
}

export interface RoomLayout {
  id: string;
  name: string;
  description?: string;
  width: number;
  depth: number;
  height?: number;
  unit?: string;
  source?: string;
  createdAt?: string;
  floor?: {
    size: {
      width: number;
      depth: number;
    };
    material: {
      color: string;
      roughness: number;
    };
  };
  camera?: {
    type: "orthographic";
    position: {
      x: number;
      y: number;
      z: number;
    };
    target: {
      x: number;
      y: number;
      z: number;
    };
    zoom: number;
  };
  lighting?: {
    ambient: number;
    sun: {
      intensity: number;
      position: [number, number, number];
    };
    environment: string;
  };
  walls: WallSegment[];
  door: Opening;
  window: Opening;
  furniture: Furniture[];
}

export interface UserPreference {
  purpose: "study" | "rest" | "balanced";
  style: "minimal-white" | "warm-natural" | "compact-modern";
  requiredItems: FurnitureCategory[];
  inspirationImageIds: string[];
}

export interface InspirationImage {
  id: string;
  title: string;
  tags: string[];
  palette: string;
}

export type ValidationSeverity = "pass" | "warning";

export interface ValidationResult {
  id: string;
  label: string;
  severity: ValidationSeverity;
  message: string;
}

export interface AgentContext {
  room: RoomLayout;
  preference: UserPreference;
  selectedInspirations: InspirationImage[];
}
