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

export type FeedbackStatus =
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "FAILED"
  | "NEEDS_CLARIFICATION";

export type FeedbackOperationStatus =
  | "APPLIED"
  | "FAILED"
  | "SKIPPED_DEPENDENCY"
  | "NEEDS_CLARIFICATION";

export interface FeedbackOperationResult {
  operationId: string;
  operationType: string;
  status: FeedbackOperationStatus;
  reasonCode?: string | null;
  message: string;
  targetFurnitureId?: string | null;
  resultFurnitureId?: string | null;
  productId?: string | null;
  variantId?: string | null;
}

export interface FeedbackClarificationCandidate {
  furnitureId: string;
  type?: string | null;
  label?: string | null;
}

export interface FeedbackClarification {
  reasonCode: string;
  question: string;
  operationId?: string | null;
  requiredField?: string | null;
  candidates?: FeedbackClarificationCandidate[];
}

export interface FeedbackExecutionSummary {
  summary?: string | null;
  noChangeReason?: string | null;
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

export interface FeedbackResponse extends Omit<LayoutResponse, "layoutId"> {
  layoutId?: number | null;
  message?: string;
  feedbackStatus?: FeedbackStatus;
  operationResults?: FeedbackOperationResult[];
  clarification?: FeedbackClarification | null;
  clarifications?: FeedbackClarification[];
  feedbackResult?: FeedbackExecutionSummary | null;
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

export async function applyLayoutFeedback(layoutId: number, feedback: string): Promise<FeedbackResponse> {
  const response = await apiClient.post<ApiResponse<unknown>>("/api/layouts/feedback", {
    layoutId,
    feedback,
  });

  return normalizeFeedbackResponse(response.data.data);
}

export function normalizeFeedbackResponse(value: unknown): FeedbackResponse {
  if (!isRecord(value)
    || !isPositiveInteger(value.roomId)
    || !Array.isArray(value.recommendedFurniture)) {
    throw new Error("Invalid layout feedback response");
  }

  const response = value as unknown as FeedbackResponse;
  const feedbackStatus = parseFeedbackStatus(value.feedbackStatus);
  const operationResults = parseOperationResults(value.operationResults);
  const clarification = parseClarification(value.clarification);
  const clarifications = parseClarifications(value.clarifications);
  const message = readOptionalString(value.message);
  const feedbackResult = parseFeedbackExecutionSummary(value.feedbackResult);
  const layoutId = isPositiveInteger(value.layoutId) ? value.layoutId : null;

  return {
    ...response,
    layoutId,
    message,
    feedbackStatus,
    operationResults,
    clarification,
    clarifications,
    feedbackResult,
  };
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

function parseFeedbackStatus(value: unknown): FeedbackStatus | undefined {
  return value === "SUCCESS"
    || value === "PARTIAL_SUCCESS"
    || value === "FAILED"
    || value === "NEEDS_CLARIFICATION"
    ? value
    : undefined;
}

function parseFeedbackOperationStatus(value: unknown): FeedbackOperationStatus | undefined {
  return value === "APPLIED"
    || value === "FAILED"
    || value === "SKIPPED_DEPENDENCY"
    || value === "NEEDS_CLARIFICATION"
    ? value
    : undefined;
}

function parseOperationResults(value: unknown): FeedbackOperationResult[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const operationId = readRequiredString(item.operationId);
    const operationType = readRequiredString(item.operationType);
    const status = parseFeedbackOperationStatus(item.status);
    const message = typeof item.message === "string" ? item.message : undefined;

    if (!operationId || !operationType || !status || message === undefined) return [];

    return [{
      operationId,
      operationType,
      status,
      message,
      ...readNullableStringProperty(item, "reasonCode"),
      ...readNullableStringProperty(item, "targetFurnitureId"),
      ...readNullableStringProperty(item, "resultFurnitureId"),
      ...readNullableStringProperty(item, "productId"),
      ...readNullableStringProperty(item, "variantId"),
    }];
  });
}

function parseClarification(value: unknown): FeedbackClarification | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;

  const reasonCode = readRequiredString(value.reasonCode);
  const question = readRequiredString(value.question);
  if (!reasonCode || !question) return undefined;

  const candidates = Array.isArray(value.candidates)
    ? value.candidates.flatMap((candidate) => {
      if (!isRecord(candidate)) return [];
      const furnitureId = readRequiredString(candidate.furnitureId);
      if (!furnitureId) return [];
      return [{
        furnitureId,
        ...readNullableStringProperty(candidate, "type"),
        ...readNullableStringProperty(candidate, "label"),
      }];
    })
    : undefined;

  return {
    reasonCode,
    question,
    ...readNullableStringProperty(value, "operationId"),
    ...readNullableStringProperty(value, "requiredField"),
    ...(candidates !== undefined ? { candidates } : {}),
  };
}

function parseClarifications(value: unknown): FeedbackClarification[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const clarification = parseClarification(item);
    return clarification && clarification !== null ? [clarification] : [];
  });
}

function parseFeedbackExecutionSummary(value: unknown): FeedbackExecutionSummary | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;

  const summary = readOptionalNullableString(value.summary);
  const noChangeReason = readOptionalNullableString(value.noChangeReason);
  return {
    ...(summary !== undefined ? { summary } : {}),
    ...(noChangeReason !== undefined ? { noChangeReason } : {}),
  };
}

function readNullableStringProperty<K extends string>(
  value: Record<string, unknown>,
  key: K,
): Partial<Record<K, string | null>> {
  const property = readOptionalNullableString(value[key]);
  return property === undefined ? {} : { [key]: property } as Record<K, string | null>;
}

function readRequiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readOptionalNullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === "string" ? value : undefined;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
