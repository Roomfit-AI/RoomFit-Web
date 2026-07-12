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

export async function createDefaultAgentContext(roomId: number): Promise<AgentContextResponse> {
  const response = await apiClient.post<ApiResponse<AgentContextResponse>>("/api/agent/context", {
    roomId,
    lifestyleGoal: "STUDY_FOCUSED",
    designStyle: ["MINIMAL", "WHITE_TONE"],
    requiredItems: ["bed", "desk", "chair"],
    optionalItems: ["storage", "rug", "lamp"],
    selectedImageIds: [1, 3],
    selectedProductIds: ["desk-01", "chair-01", "lamp-01"],
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
