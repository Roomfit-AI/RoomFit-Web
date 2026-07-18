import { isAxiosError } from "axios";

import { apiClient } from "./client";
import {
  buildAgentContextRequest,
  type DesignStyleApiValue,
  type FurnitureTypeApiValue,
  type LifestyleGoalApiValue,
} from "./agentContextRequest";
import type { PreferredColorToneApiValue } from "../config/preferredColorTone";
import type { BackendFurnitureApiItem } from "./rooms";
import type { Furniture, RoomLayout } from "../types";

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
  roomId: number;
  sourceLayoutId: number | null;
  confirmed: boolean;
  confirmedAt: string | null;
  status: string;
  recommendedFurniture: BackendFurnitureApiItem[];
  scoreSummary: ScoreSummary;
  validationResult: LayoutValidationResult;
  interpretedIntent?: InterpretedIntent;
}

export interface ConfirmResponse {
  layoutId: number;
  confirmed: boolean;
  confirmedAt: string;
}

export interface DraftFurnitureAdditionRequest {
  contextId: number;
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

export async function getLayout(layoutId: number): Promise<LayoutResponse> {
  const response = await apiClient.get<ApiResponse<LayoutResponse>>(`/api/layouts/${layoutId}`);
  return response.data.data;
}

export async function getLatestConfirmedLayout(roomId: number): Promise<LayoutResponse | null> {
  try {
    const response = await apiClient.get<ApiResponse<LayoutResponse>>(
      `/api/layouts/rooms/${roomId}/confirmed/latest`,
    );
    return response.data.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createLayoutDraft(layoutId: number): Promise<LayoutResponse> {
  const response = await apiClient.post<ApiResponse<LayoutResponse>>(`/api/layouts/${layoutId}/draft`);
  return response.data.data;
}

export async function updateLayout(layoutId: number, room: RoomLayout): Promise<LayoutResponse> {
  const response = await apiClient.put<ApiResponse<LayoutResponse>>(`/api/layouts/${layoutId}`, {
    furniture: room.furniture.map((item) => toFurniturePositionRequest(room, item)),
  });
  return response.data.data;
}

export async function addFurnitureToDraft(
  layoutId: number,
  request: DraftFurnitureAdditionRequest,
): Promise<LayoutResponse> {
  const response = await apiClient.post<ApiResponse<LayoutResponse>>(
    `/api/layouts/${layoutId}/furniture-additions`,
    request,
  );
  return response.data.data;
}

export async function confirmLayout(layoutId: number): Promise<ConfirmResponse> {
  const response = await apiClient.post<ApiResponse<ConfirmResponse>>(`/api/layouts/${layoutId}/confirm`);
  return response.data.data;
}

export async function applyLayoutFeedback(layoutId: number, feedback: string): Promise<LayoutResponse> {
  const response = await apiClient.post<ApiResponse<LayoutResponse>>("/api/layouts/feedback", {
    layoutId,
    feedback,
  });

  return response.data.data;
}

export function toFurniturePositionRequest(room: RoomLayout, item: Furniture) {
  return {
    id: item.id,
    position: {
      x: item.position.x + room.width / 2,
      z: item.position.z + room.depth / 2,
    },
    rotation: normalizeDegrees((-item.rotationY * 180) / Math.PI),
    status: toFurnitureStatusApiValue(item.status),
  };
}

function toFurnitureStatusApiValue(status: Furniture["status"]): string {
  const values: Record<Furniture["status"], string> = {
    existing: "EXISTING",
    recommended: "RECOMMENDED",
    user_modified: "USER_MODIFIED",
    deleted: "DELETED",
  };
  return values[status];
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
