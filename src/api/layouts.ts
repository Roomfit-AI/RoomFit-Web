import { apiClient } from "./client";
import {
  buildAgentContextRequest,
  type DesignStyleApiValue,
  type FurnitureTypeApiValue,
  type LifestyleGoalApiValue,
} from "./agentContextRequest";
import type { PreferredColorToneApiValue } from "../config/preferredColorTone";
import type { BackendFurnitureApiItem } from "./rooms";

export type {
  AgentContextRequest,
  DesignStyleApiValue,
  LifestyleGoalApiValue,
} from "./agentContextRequest";

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
  lifestyleGoal: LifestyleGoalApiValue;
  designStyle: DesignStyleApiValue[];
  requiredItems: FurnitureTypeApiValue[];
  optionalItems: FurnitureTypeApiValue[];
  selectedImageIds: number[];
  selectedProductIds: string[];
  styleTags: string[];
  preferredColorTone: PreferredColorToneApiValue | null;
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

function readStringArrayFromStorage(key: string): string[] {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function createDefaultAgentContext(roomId: number): Promise<AgentContextResponse> {
  const request = buildAgentContextRequest({
    roomId,
    purpose: localStorage.getItem("roomfit:selectedPurpose"),
    style: localStorage.getItem("roomfit:selectedStyle"),
    palette: localStorage.getItem("roomfit:selectedPalette"),
    additionalFurnitureIds: readStringArrayFromStorage("roomfit:selectedAdditionalFurnitureIds"),
  });
  const response = await apiClient.post<ApiResponse<AgentContextResponse>>(
    "/api/agent/context",
    request,
  );

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
