import type { LayoutValidationResult, ScoreSummary } from "../api/layouts";
import { createHobbyCoralRecommendation, isHobbyCoralRecommendationSelected } from "../mock/hobbyCoralRecommendation";
import type { Furniture, RoomLayout } from "../types";
import { withAppliedPreferredColorTone } from "./appliedColorTone";
import { buildScenarioValidation } from "./localValidation";
import { readPreferredColorTone } from "./preferredColorTone";
import { applyScenario, currentScenario, isCollectorRoom } from "./scenarios";

type LocalRecommendationStorage = Pick<Storage, "getItem">;

export interface LocalRecommendationResult {
  roomLayout: RoomLayout;
  scoreSummary: ScoreSummary;
  validationResult: LayoutValidationResult;
}

const naturalWoodRestRoomExistingFurnitureIds = new Set(["bed-1", "desk-1", "chair-1"]);

const naturalWoodRestRoomFurniture: Furniture[] = [
  {
    id: "natural-wardrobe", name: "루버 우드 옷장", category: "cabinet", geometry: "box",
    dimensions: { width: 0.88, depth: 0.58, height: 1.78 }, position: { x: 2.46, z: 0.2 },
    rotationY: -Math.PI / 2, color: "#c9955d",
    material: { type: "wood", color: "#c9955d", roughness: 0.58, metalness: 0 }, status: "recommended", removable: true,
  },
  {
    id: "natural-bedside-table", name: "우드 협탁", category: "cabinet", geometry: "box",
    dimensions: { width: 0.5, depth: 0.42, height: 0.48 }, position: { x: -2.6, z: -1.3 },
    rotationY: 0, color: "#c9955d",
    material: { type: "wood", color: "#c9955d", roughness: 0.56, metalness: 0 }, status: "recommended", removable: true,
  },
  {
    id: "natural-bedside-lamp", name: "침대 옆 스탠드", category: "lighting", geometry: "cylinder",
    dimensions: { width: 0.18, depth: 0.18, height: 0.48 }, position: { x: -2.55, z: -0.92 },
    rotationY: 0, color: "#d4a96a",
    material: { type: "metal", color: "#d4a96a", roughness: 0.32, metalness: 0.45 }, status: "recommended", removable: true,
  },
  {
    id: "natural-window-plant", name: "바닥 식물", category: "cabinet", geometry: "cylinder",
    dimensions: { width: 0.42, depth: 0.42, height: 0.76 }, position: { x: -2.55, z: 1.62 },
    rotationY: 0, color: "#3f7d4a",
    material: { type: "accent", color: "#3f7d4a", roughness: 0.8, metalness: 0 }, status: "recommended", removable: true,
  },
  {
    id: "natural-low-bookshelf", name: "낮은 우드 책장", category: "cabinet", geometry: "box",
    dimensions: { width: 1.1, depth: 0.34, height: 0.7 }, position: { x: 1.65, z: -2.18 },
    rotationY: 0, color: "#c9955d",
    material: { type: "wood", color: "#c9955d", roughness: 0.56, metalness: 0 }, status: "recommended", removable: true,
  },
  {
    id: "natural-shelf-back-left", name: "우드 벽 선반", category: "cabinet", geometry: "box",
    dimensions: { width: 0.92, depth: 0.18, height: 0.2 }, position: { x: 0.1, z: -2.5 },
    rotationY: 0, color: "#b9824a",
    material: { type: "wood", color: "#b9824a", roughness: 0.55, metalness: 0 }, status: "recommended", removable: true,
  },
  {
    id: "natural-shelf-back-right", name: "우드 벽 선반", category: "cabinet", geometry: "box",
    dimensions: { width: 0.96, depth: 0.18, height: 0.2 }, position: { x: 1.35, z: -2.5 },
    rotationY: 0, color: "#b9824a",
    material: { type: "wood", color: "#b9824a", roughness: 0.55, metalness: 0 }, status: "recommended", removable: true,
  },
  {
    id: "natural-lounge-chair", name: "세이지 라운지 소파", category: "chair", geometry: "rounded-box",
    dimensions: { width: 0.78, depth: 0.72, height: 0.78 }, position: { x: 1.72, z: 1.6 },
    rotationY: -Math.PI * 0.58, color: "#8fae76",
    material: { type: "fabric", color: "#8fae76", roughness: 0.82, metalness: 0 }, status: "recommended", removable: true,
  },
  {
    id: "natural-rattan-rug", name: "원형 라탄 러그", category: "rug", geometry: "cylinder",
    dimensions: { width: 1.55, depth: 1.55, height: 0.035 }, position: { x: 0.72, z: 1.36 },
    rotationY: 0, color: "#d4bd91",
    material: { type: "fabric", color: "#d4bd91", roughness: 0.9, metalness: 0 }, status: "recommended", removable: true,
  },
  {
    id: "natural-coffee-table", name: "원형 우드 테이블", category: "desk", geometry: "cylinder",
    dimensions: { width: 0.68, depth: 0.68, height: 0.38 }, position: { x: 0.72, z: 1.36 },
    rotationY: 0, color: "#c9955d",
    material: { type: "wood", color: "#c9955d", roughness: 0.55, metalness: 0 }, status: "recommended", removable: true,
  },
  {
    id: "natural-table-plant", name: "화병", category: "cabinet", geometry: "cylinder",
    dimensions: { width: 0.2, depth: 0.2, height: 0.28 }, position: { x: 0.72, z: 1.36 },
    rotationY: 0, color: "#4e8a55",
    material: { type: "accent", color: "#4e8a55", roughness: 0.8, metalness: 0 }, status: "recommended", removable: true,
  },
];

export function createLocalRecommendation(
  room: RoomLayout,
  storage: LocalRecommendationStorage = localStorage,
): LocalRecommendationResult | null {
  let recommended: RoomLayout;

  if (isHobbyCoralRecommendationSelected(storage)) {
    recommended = createHobbyCoralRecommendation(room);
  } else {
    const scenario = room.source === "CUSTOM" || isCollectorRoom(room)
      ? undefined
      : currentScenario(storage);
    if (!scenario) return null;

    recommended = scenario.id === "rest-natural-wood" && room.source !== "ROOMPLAN"
      ? applyNaturalWoodRestRoom(room, room.furniture)
      : applyScenario(room, scenario);
  }

  const { scoreSummary, validationResult } = buildScenarioValidation();
  return {
    roomLayout: withAppliedPreferredColorTone(recommended, readPreferredColorTone(storage)),
    scoreSummary,
    validationResult,
  };
}

function applyNaturalWoodRestRoom(layout: RoomLayout, sourceFurniture: Furniture[]): RoomLayout {
  const naturalWoodExistingFurniture = sourceFurniture
    .filter((item) => naturalWoodRestRoomExistingFurnitureIds.has(item.id))
    .map((item) => {
      if (item.id === "bed-1") {
        return { ...item, position: { x: -1.5, z: -1.12 }, color: "#f5f0e4", material: { type: "fabric" as const, color: "#f5f0e4", roughness: 0.88, metalness: 0 } };
      }
      if (item.id === "desk-1") {
        return { ...item, position: { x: 0.25, z: -1.85 }, rotationY: 0, color: "#d0a46c", material: { type: "wood" as const, color: "#d0a46c", roughness: 0.58, metalness: 0 } };
      }
      if (item.id === "chair-1") {
        return { ...item, position: { x: 0.25, z: -0.98 }, rotationY: Math.PI, color: "#c9955d", material: { type: "wood" as const, color: "#c9955d", roughness: 0.58, metalness: 0 } };
      }
      return item;
    });

  return {
    ...layout,
    floor: { size: { width: layout.width, depth: layout.depth }, material: { color: "#d2a86e", roughness: 0.72 } },
    lighting: { ...layout.lighting, ambient: 0.84, sun: { intensity: 1.9, position: [3.8, 7.5, 4.6] }, environment: "warm-natural-studio" },
    walls: layout.walls.map((wall) => ({ ...wall, material: { color: "#f3efe7", roughness: 0.84 } })),
    furniture: [...naturalWoodExistingFurniture, ...naturalWoodRestRoomFurniture],
  };
}
