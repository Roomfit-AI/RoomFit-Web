export type FurnitureCategory =
  | "bed"
  | "desk"
  | "chair"
  | "cabinet"
  | "rug"
  | "lighting";

export type FurnitureStatus = "existing" | "recommended";

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
  material: "fabric" | "wood" | "white" | "metal" | "glass" | "accent";
  status: FurnitureStatus;
  removable: boolean;
}

export interface WallSegment {
  id: string;
  start: Vector2D;
  end: Vector2D;
}

export interface Opening {
  id: string;
  label: string;
  position: Vector2D;
  dimensions: Size3D;
  rotationY: number;
}

export interface RoomLayout {
  id: string;
  name: string;
  description?: string;
  width: number;
  depth: number;
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
