import { AgentContextRequestValidationError, normalizeBackendRoomId } from "../api/agentContextRequest";
import type { LayoutNavigationState } from "./layoutEditingSession";
import { getFurnitureAdditionErrorMessage } from "./furnitureAdditionError";
import { readActiveClientScope } from "./clientScope";
import {
  getFurnitureSelectionGuidanceMessage,
  getPreferenceGuidanceMessage,
  getReferenceStyleGuidanceMessage,
  readAdditionalFurnitureSelection,
  readInteriorStyleSelection,
  readPreferenceSelection,
} from "./onboardingSelection";
import { RecommendationFeasibilityError } from "./recommendationResult";
import { readRoomSetupSession } from "./roomSetupSession";

type ReadableStorage = Pick<Storage, "getItem">;
type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface RecommendationPreparation {
  ready: boolean;
  message: string;
  roomId: number | null;
  roomLayoutId: string | null;
  roomTitle: string;
  selectedFurnitureCount: number;
}

export function readRecommendationPreparation(
  storage: ReadableStorage = localStorage,
  browserSession: SessionStorage = sessionStorage,
): RecommendationPreparation {
  const roomId = normalizeBackendRoomId(storage.getItem("roomfit:backendRoomId"));
  const roomLayoutId = storage.getItem("roomfit:selectedRoomId");
  const roomTitle = storage.getItem("roomfit:selectedRoomTitle") ?? "선택한 공간";
  const setup = readRoomSetupSession(browserSession);
  const activeScope = readActiveClientScope(browserSession);
  const selectedFurniture = readAdditionalFurnitureSelection(storage);
  const preferenceMessage = getPreferenceGuidanceMessage(readPreferenceSelection(storage));
  const styleMessage = getReferenceStyleGuidanceMessage(readInteriorStyleSelection(storage));
  const furnitureMessage = getFurnitureSelectionGuidanceMessage(selectedFurniture);

  const stateMatches = roomId !== null
    && Boolean(roomLayoutId)
    && setup?.roomLayoutId === roomLayoutId
    && setup.backendRoomId === roomId
    && activeScope?.setupSessionId === setup.sessionId
    && activeScope.roomLayoutId === roomLayoutId
    && activeScope.backendRoomId === roomId;
  const message = !stateMatches
    ? "추천에 필요한 방 정보가 없습니다. 이전 단계에서 방을 다시 확인해 주세요."
    : preferenceMessage || styleMessage || furnitureMessage;

  return {
    ready: message === "",
    message,
    roomId,
    roomLayoutId,
    roomTitle,
    selectedFurnitureCount: selectedFurniture.length,
  };
}

interface RecommendationGenerationControllerOptions {
  generate: () => Promise<LayoutNavigationState | null>;
  navigate: (path: string, options: { state: LayoutNavigationState }) => void;
  onRunningChange: (running: boolean) => void;
  onFailure: (error: unknown | null) => void;
}

export interface RecommendationGenerationController {
  run: () => Promise<void>;
  isRunning: () => boolean;
}

export function createRecommendationGenerationController({
  generate,
  navigate,
  onRunningChange,
  onFailure,
}: RecommendationGenerationControllerOptions): RecommendationGenerationController {
  let inFlight: Promise<void> | null = null;

  return {
    run: () => {
      if (inFlight) return inFlight;
      onFailure(null);
      onRunningChange(true);
      inFlight = (async () => {
        try {
          const state = await generate();
          if (!state) {
            throw new Error("MISSING_RECOMMENDATION_STATE");
          }
          navigate("/editor", { state });
        } catch (error) {
          onFailure(error);
        } finally {
          onRunningChange(false);
          inFlight = null;
        }
      })();
      return inFlight;
    },
    isRunning: () => inFlight !== null,
  };
}

export function getRecommendationGenerationErrorMessage(error: unknown): string {
  if (error instanceof RecommendationFeasibilityError) return error.notice.message;
  if (error instanceof AgentContextRequestValidationError) return error.message;
  return getFurnitureAdditionErrorMessage(error)
    ?? "AI 추천 생성에 실패했습니다. 선택한 내용을 유지한 채 다시 시도해 주세요.";
}
