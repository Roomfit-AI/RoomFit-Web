import { apiClient } from "./client";
import type { BackendFurnitureApiItem } from "./rooms";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  } | null;
}

export interface AgentContextResponse {
  contextId: number;
  roomId: number;
  lifestyleGoal: string;
  designStyle: string[];
  requiredItems: string[];
  optionalItems: string[];
  selectedImageIds: number[];
  selectedProductIds: string[];
  styleTags: string[];
}

export interface ScoreSummary {
  collisionScore: number;
  boundaryScore: number;
  doorWindowScore: number;
  pathScore: number;
  goalScore: number;
  styleScore: number;
  totalScore: number;
}

export interface LayoutValidationResult {
  collisionFree: boolean;
  boundaryValid: boolean;
  doorClearance: boolean;
  windowClearance: boolean;
  pathSecured: boolean;
  warnings: string[];
}

export interface InterpretedIntent {
  source?: "LLM" | "RULE_BASED" | string;
  rawIntent?: string;
  targetFurniture?: string;
  deskMinWidth?: number;
  constraints?: Record<string, unknown>;
  fallbackUsed?: boolean;
}

export interface LayoutResponse {
  layoutId: number;
  status: string;
  recommendedFurniture: BackendFurnitureApiItem[];
  scoreSummary: ScoreSummary;
  validationResult: LayoutValidationResult;
  interpretedIntent?: InterpretedIntent;
}

function readStringArrayFromStorage(key: string, fallback: string[]): string[] {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : fallback;
  } catch {
    return fallback;
  }
}

function getWorkflowLifestyleGoal(): string {
  const purpose = localStorage.getItem("roomfit:selectedPurpose") ?? "work";

  if (purpose === "work" || purpose === "hobby") {
    return "STUDY_FOCUSED";
  }

  return "STUDY_FOCUSED";
}

function getWorkflowDesignStyle(): string[] {
  const selectedStyle = localStorage.getItem("roomfit:selectedStyle") ?? "minimal";
  const selectedPalette = localStorage.getItem("roomfit:selectedPalette") ?? "ivory";
  const designStyle = new Set<string>();

  if (selectedStyle === "minimal") {
    designStyle.add("MINIMAL");
  }

  if (selectedPalette === "ivory") {
    designStyle.add("WHITE_TONE");
  }

  if (designStyle.size === 0) {
    designStyle.add("MINIMAL");
    designStyle.add("WHITE_TONE");
  }

  return Array.from(designStyle);
}

function getWorkflowOptionalItems(): string[] {
  const selectedIds = readStringArrayFromStorage("roomfit:selectedAdditionalFurnitureIds", ["floor-lamp", "soft-rug"]);
  const optionalItems = new Set<string>(["storage"]);

  if (selectedIds.some((id) => id.includes("lamp") || id.includes("pendant"))) {
    optionalItems.add("lamp");
  }

  if (selectedIds.some((id) => id.includes("rug"))) {
    optionalItems.add("rug");
  }

  if (selectedIds.some((id) => id.includes("shelf") || id.includes("tv") || id.includes("storage"))) {
    optionalItems.add("storage");
  }

  return Array.from(optionalItems);
}

function getWorkflowSelectedProductIds(): string[] {
  const selectedIds = readStringArrayFromStorage("roomfit:selectedAdditionalFurnitureIds", ["floor-lamp", "soft-rug"]);
  const productIds = new Set<string>(["desk-01", "chair-01"]);

  if (selectedIds.some((id) => id.includes("lamp") || id.includes("pendant"))) {
    productIds.add("lamp-01");
  }

  return Array.from(productIds);
}

export async function createDefaultAgentContext(roomId: number): Promise<AgentContextResponse> {
  const response = await apiClient.post<ApiResponse<AgentContextResponse>>("/api/agent/context", {
    roomId,
    lifestyleGoal: getWorkflowLifestyleGoal(),
    designStyle: getWorkflowDesignStyle(),
    requiredItems: ["bed", "desk", "chair"],
    optionalItems: getWorkflowOptionalItems(),
    selectedImageIds: [1, 3],
    selectedProductIds: getWorkflowSelectedProductIds(),
  });

  return response.data.data;
}

export async function recommendLayout(roomId: number, contextId: number): Promise<LayoutResponse> {
  const response = await apiClient.post<ApiResponse<LayoutResponse>>("/api/layouts/recommend", {
    roomId,
    contextId,
  });

  return response.data.data;
}

export async function applyLayoutFeedback(layoutId: number, feedback: string): Promise<LayoutResponse> {
  const response = await apiClient.post<ApiResponse<LayoutResponse>>("/api/layouts/feedback", {
    layoutId,
    feedback,
  });

  return response.data.data;
}
