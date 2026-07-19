import { isAxiosError } from "axios";

import type { FeedbackPresentation } from "./feedbackPresentation";

export interface FeedbackResultState {
  presentation: FeedbackPresentation | null;
  errorMessage: string;
}

export interface FeedbackResponseGuard {
  isMounted: boolean;
  currentSequence: number;
  requestSequence: number;
  activeLayoutId: number | null;
  requestedLayoutId: number;
}

interface MutableBooleanRef {
  current: boolean;
}

export function createEmptyFeedbackResult(): FeedbackResultState {
  return { presentation: null, errorMessage: "" };
}

export function createSuccessfulFeedbackPresentation(): FeedbackPresentation {
  return {
    feedbackStatus: "SUCCESS",
    summaryMessage: null,
    operationResults: [],
    clarifications: [],
    appliedCount: 0,
    failedCount: 0,
    pendingCount: 0,
    showPanel: true,
  };
}

export function beginFeedbackRequest(inFlightRef: MutableBooleanRef): boolean {
  if (inFlightRef.current) return false;
  inFlightRef.current = true;
  return true;
}

export function shouldAcceptFeedbackResponse({
  isMounted,
  currentSequence,
  requestSequence,
  activeLayoutId,
  requestedLayoutId,
}: FeedbackResponseGuard): boolean {
  return isMounted
    && currentSequence === requestSequence
    && activeLayoutId === requestedLayoutId;
}

export function readFeedbackErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const payload: unknown = error.response?.data;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const apiError = (payload as Record<string, unknown>).error;
      if (apiError && typeof apiError === "object" && !Array.isArray(apiError)) {
        const message = (apiError as Record<string, unknown>).message;
        if (typeof message === "string" && message.trim()) return message;
      }
    }
  }

  return "피드백 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
