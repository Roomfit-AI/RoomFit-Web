import { useEffect, useReducer, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  applyLayoutFeedback,
  createDefaultAgentContext,
  getLayout,
  recommendLayout,
  type InterpretedIntent,
  type LayoutValidationResult,
  type ScoreSummary,
} from "../api/layouts";
import {
  AgentContextRequestValidationError,
  normalizeBackendRoomId,
} from "../api/agentContextRequest";
import { applyBackendFurnitureToLayout } from "../api/rooms";
import { ensureCustomRoomBackendRoom } from "../api/customRoomBackend";
import EditorFeedbackPanel from "../components/editor/EditorFeedbackPanel";
import {
  createEmptyFeedbackResult,
  readFeedbackErrorMessage,
  type FeedbackResultState,
} from "../components/editor/feedbackResultState";
import RecommendationResultPanel from "../components/editor/RecommendationResultPanel";
import ScoreSummaryPanel from "../components/editor/ScoreSummaryPanel";
import SelectedFurnitureActions from "../components/editor/SelectedFurnitureActions";
import {
  canUndoEditorLayout,
  createEditorLayoutHistory,
  reduceEditorLayoutHistory,
} from "../components/editor/editorLayoutHistory";
import {
  resolveFeedbackRoomLayout,
  resolveNextFeedbackLayoutId,
} from "../components/editor/feedbackPresentation";
import RoomViewer from "../components/room/RoomViewer";
import { moveFurnitureInsideRoom, rotateFurnitureInsideRoom } from "../components/room/furnitureBoundary";
import { getLiveMirrorForSelectedRoom } from "../config/confirmedLayouts";
import { readActiveClientScope } from "../config/clientScope";
import {
  resolveRoomLayoutPreferredColorTone,
  withAppliedPreferredColorTone,
} from "../config/appliedColorTone";
import { readPreferredColorTone } from "../config/preferredColorTone";
import {
  isSessionForRoom,
  readActiveLayoutEditingSession,
  readLayoutNavigationState,
  resolveEditorInitialRoomLayout,
  saveLayoutResponseSession,
} from "../config/layoutEditingSession";
import {
  clearRecommendationResult,
  readRecommendationResult,
  resolveRecommendationDecision,
  saveRecommendationResult,
  type RecommendationResultNotice,
  type RecommendationResultOwner,
} from "../config/recommendationResult";
import { readRoomSetupSession } from "../config/roomSetupSession";
import type { Furniture, RoomLayout, Vector2D } from "../types";

// The latest room mirror saved by the setup/editor workflow. Reset uses this
// persisted baseline rather than whatever transient furniture edits are
// currently on screen.
function loadSelectedRoomLayout(): RoomLayout | null {
  const raw = localStorage.getItem("roomfit:selectedRoomLayout");

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RoomLayout;
  } catch {
    return null;
  }
}

function loadBackendRoomId(): number | null {
  return normalizeBackendRoomId(localStorage.getItem("roomfit:backendRoomId"));
}

function readCurrentRecommendationOwner(): RecommendationResultOwner | null {
  const setup = readRoomSetupSession();
  if (!setup?.roomLayoutId || setup.backendRoomId === null) return null;
  return {
    sessionId: setup.sessionId,
    roomLayoutId: setup.roomLayoutId,
    backendRoomId: setup.backendRoomId,
  };
}

function readCurrentRecommendationNotice(): RecommendationResultNotice | null {
  return readRecommendationResult(readCurrentRecommendationOwner());
}

function saveCurrentRecommendationNotice(notice: RecommendationResultNotice): void {
  const owner = readCurrentRecommendationOwner();
  if (owner) saveRecommendationResult(owner, notice);
}

function clearCurrentRecommendationNotice(): void {
  const owner = readCurrentRecommendationOwner();
  if (owner) clearRecommendationResult(sessionStorage, owner);
}

export default function EditorPlaceholder() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeNavigationState = readLayoutNavigationState(location.state);
  const selectedBaseline = loadSelectedRoomLayout();
  const backendRoomId = loadBackendRoomId();
  const storedSession = readActiveLayoutEditingSession();
  const matchingSession = selectedBaseline && backendRoomId !== null
    && isSessionForRoom(storedSession, selectedBaseline.id, backendRoomId)
    ? storedSession
    : null;
  const ownedRouteNavigationState = routeNavigationState
    && selectedBaseline
    && backendRoomId === routeNavigationState.roomId
    && selectedBaseline.id === routeNavigationState.roomLayoutId
    ? routeNavigationState
    : null;
  const navigationState = matchingSession
    && ownedRouteNavigationState?.activeLayoutId !== matchingSession.activeLayoutId
    ? null
    : ownedRouteNavigationState;
  const matchingSessionLayoutId = matchingSession?.activeLayoutId ?? null;
  const matchingSessionBackendRoomId = matchingSession?.backendRoomId ?? null;
  const matchingSessionEditingMode = matchingSession?.editingMode;
  const navigationHasSavedDraft = Boolean(navigationState?.roomLayout && navigationState.layoutResponse);
  const activeClientScope = readActiveClientScope();
  const editorScopeKey = JSON.stringify({
    roomLayoutId: selectedBaseline?.id ?? null,
    backendRoomId,
    clientMode: activeClientScope?.mode ?? null,
    clientId: activeClientScope?.clientId ?? null,
    setupSessionId: activeClientScope?.setupSessionId ?? null,
    scopedRoomLayoutId: activeClientScope?.roomLayoutId ?? null,
    scopedBackendRoomId: activeClientScope?.backendRoomId ?? null,
  });
  const [layoutHistory, dispatchLayoutHistory] = useReducer(
    reduceEditorLayoutHistory,
    undefined,
    () => createEditorLayoutHistory(resolveEditorInitialRoomLayout({
      navigationState,
      activeSession: matchingSession,
      selectedRoomLayout: selectedBaseline,
      liveMirror: getLiveMirrorForSelectedRoom(),
    }), editorScopeKey),
  );
  const roomLayout = layoutHistory.roomLayout;
  const canUndo = canUndoEditorLayout(layoutHistory, editorScopeKey);
  const preferredColorTone = roomLayout
    ? resolveRoomLayoutPreferredColorTone(roomLayout)
    : null;
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState<number | null>(
    navigationState?.activeLayoutId ?? matchingSession?.activeLayoutId ?? null,
  );
  const [feedback, setFeedback] = useState("");
  const [hideEntranceWalls, setHideEntranceWalls] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [isApplyingFeedback, setIsApplyingFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(
    navigationState?.layoutResponse?.scoreSummary ?? null,
  );
  const [validationResult, setValidationResult] = useState<LayoutValidationResult | null>(
    navigationState?.layoutResponse?.validationResult ?? null,
  );
  const [interpretedIntent, setInterpretedIntent] = useState<InterpretedIntent | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<FeedbackResultState>(createEmptyFeedbackResult);
  const [recommendationNotice, setRecommendationNotice] = useState<RecommendationResultNotice | null>(
    readCurrentRecommendationNotice,
  );
  const recommendationInFlightRef = useRef(false);
  const feedbackInFlightRef = useRef(false);
  const customRoomCreationRef = useRef<Promise<number> | null>(null);

  useEffect(() => {
    if (matchingSessionLayoutId === null || matchingSessionBackendRoomId === null || navigationHasSavedDraft) return;
    let cancelled = false;

    getLayout(matchingSessionLayoutId)
      .then((response) => {
        if (cancelled) return;
        const baseline = loadSelectedRoomLayout();
        if (!baseline || response.roomId !== matchingSessionBackendRoomId) return;
        const restored = applyBackendFurnitureToLayout(baseline, response.recommendedFurniture);
        dispatchLayoutHistory({ type: "replace", roomLayout: restored, scopeKey: editorScopeKey });
        setLayoutId(response.layoutId);
        setScoreSummary(response.scoreSummary);
        setValidationResult(response.validationResult);
        saveLayoutResponseSession(baseline.id, response, localStorage, matchingSessionEditingMode);
        localStorage.setItem("roomfit:selectedRoomLayout", JSON.stringify(restored));
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage("편집 중인 배치를 불러오지 못했습니다. 방을 다시 선택해 주세요.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editorScopeKey, matchingSessionBackendRoomId, matchingSessionEditingMode, matchingSessionLayoutId, navigationHasSavedDraft]);

  useEffect(() => {
    if (!roomLayout) {
      return;
    }

    localStorage.setItem("roomfit:selectedRoomLayout", JSON.stringify(roomLayout));
  }, [roomLayout]);

  const handleMoveFurniture = (id: string, position: Vector2D) => {
    dispatchLayoutHistory({
      type: "updateEdit",
      scopeKey: editorScopeKey,
      update: (current) => ({
        ...current,
        furniture: current.furniture.map((item) =>
          item.id === id
            ? markUserModified(moveFurnitureInsideRoom(current, item, position))
            : item,
        ),
      }),
    });
  };

  const handleBeginMoveFurniture = () => {
    dispatchLayoutHistory({ type: "beginEdit", scopeKey: editorScopeKey });
  };

  const handleEndMoveFurniture = () => {
    dispatchLayoutHistory({ type: "endEdit", scopeKey: editorScopeKey });
  };

  const handleRotateFurniture = (id: string) => {
    dispatchLayoutHistory({
      type: "edit",
      scopeKey: editorScopeKey,
      update: (current) => ({
        ...current,
        furniture: current.furniture.map((item) =>
          item.id === id
            ? markUserModified(rotateFurnitureInsideRoom(current, item, item.rotationY + Math.PI / 2))
            : item,
        ),
      }),
    });
  };

  const handleDeleteFurniture = (id: string) => {
    dispatchLayoutHistory({
      type: "edit",
      scopeKey: editorScopeKey,
      update: (current) => ({
        ...current,
        furniture: current.furniture.map((item) => (
          item.id === id ? { ...item, status: "deleted" } : item
        )),
      }),
    });
    setSelectedFurnitureId(null);
  };

  const handleUndoFurnitureEdit = () => {
    dispatchLayoutHistory({ type: "undo", scopeKey: editorScopeKey });
    setSelectedFurnitureId(null);
  };

  const handleRecommend = async () => {
    if (!roomLayout) {
      setErrorMessage("먼저 /rooms에서 샘플 방을 선택해 주세요.");
      return;
    }

    if (recommendationInFlightRef.current) {
      return;
    }
    recommendationInFlightRef.current = true;

    const recommendationColorTone = readPreferredColorTone() ?? preferredColorTone;

    let roomId = loadBackendRoomId();

    if (roomLayout.source === "CUSTOM") {
      setIsRecommending(true);
      setErrorMessage("");
      setInterpretedIntent(null);

      try {
        const customRoomSnapshot = loadSelectedRoomLayout() ?? roomLayout;
        customRoomCreationRef.current ??= ensureCustomRoomBackendRoom({ room: customRoomSnapshot });
        roomId = await customRoomCreationRef.current;
      } catch {
        setErrorMessage("커스텀 방을 백엔드에 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        setIsRecommending(false);
        recommendationInFlightRef.current = false;
        return;
      } finally {
        customRoomCreationRef.current = null;
      }
    }

    if (roomId === null) {
      setErrorMessage("유효한 백엔드 방을 다시 선택해 주세요.");
      recommendationInFlightRef.current = false;
      return;
    }

    setIsRecommending(true);
    setErrorMessage("");
    setInterpretedIntent(null);

    try {
      const context = await createDefaultAgentContext(roomId);
      const result = await recommendLayout(roomId, context.contextId);

      const decision = resolveRecommendationDecision(result);
      if (decision.status === "FAILED") {
        setScoreSummary(result.scoreSummary);
        setValidationResult(result.validationResult);
        setInterpretedIntent(result.interpretedIntent ?? null);
        if (decision.notice) {
          saveCurrentRecommendationNotice(decision.notice);
          setRecommendationNotice(decision.notice);
        }
        return;
      }
      if (result.layoutId === null) {
        throw new Error("Backend recommendation response has no persisted layoutId.");
      }

      const recommendedLayout = applyBackendFurnitureToLayout(roomLayout, result.recommendedFurniture);
      dispatchLayoutHistory({
        type: "replace",
        roomLayout: withAppliedPreferredColorTone(recommendedLayout, recommendationColorTone),
        scopeKey: editorScopeKey,
      });
      setLayoutId(result.layoutId);
      saveLayoutResponseSession(roomLayout.id, { ...result, layoutId: result.layoutId });
      setScoreSummary(result.scoreSummary);
      setValidationResult(result.validationResult);
      if (decision.notice) {
        saveCurrentRecommendationNotice(decision.notice);
        setRecommendationNotice(decision.notice);
      } else {
        clearCurrentRecommendationNotice();
        setRecommendationNotice(null);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof AgentContextRequestValidationError
          ? error.message
          : "AI 추천 생성에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.",
      );
    } finally {
      setIsRecommending(false);
      recommendationInFlightRef.current = false;
    }
  };

  const handleFeedback = async () => {
    if (!roomLayout) {
      setFeedbackResult({ presentation: null, errorMessage: "먼저 /rooms에서 샘플 방을 선택해 주세요." });
      return;
    }

    if (!layoutId) {
      setFeedbackResult({ presentation: null, errorMessage: "먼저 AI 추천 생성을 실행해 주세요." });
      return;
    }

    if (!feedback.trim()) {
      setFeedbackResult({ presentation: null, errorMessage: "피드백을 입력해 주세요." });
      return;
    }

    if (feedbackInFlightRef.current) {
      return;
    }
    feedbackInFlightRef.current = true;

    setIsApplyingFeedback(true);
    setErrorMessage("");
    setFeedbackResult(createEmptyFeedbackResult());
    setInterpretedIntent(null);

    try {
      const result = await applyLayoutFeedback(layoutId, feedback.trim());
      const nextFeedback = resolveFeedbackRoomLayout(roomLayout, result);

      if (nextFeedback.roomLayout !== roomLayout) {
        dispatchLayoutHistory({
          type: "replace",
          roomLayout: nextFeedback.roomLayout,
          scopeKey: editorScopeKey,
        });
      }
      const nextLayoutId = resolveNextFeedbackLayoutId(layoutId, result.layoutId);
      if (nextLayoutId !== null) {
        setLayoutId(nextLayoutId);
        saveLayoutResponseSession(roomLayout.id, { ...result, layoutId: nextLayoutId });
      }
      setScoreSummary(result.scoreSummary);
      setValidationResult(result.validationResult);
      setInterpretedIntent(result.interpretedIntent ?? null);
      setFeedbackResult({ presentation: nextFeedback.presentation, errorMessage: "" });
    } catch (error) {
      console.error(error);
      setFeedbackResult({ presentation: null, errorMessage: readFeedbackErrorMessage(error) });
    } finally {
      setIsApplyingFeedback(false);
      feedbackInFlightRef.current = false;
    }
  };

  if (!roomLayout) {
    return (
      <main className="grid min-h-[calc(100vh-76px)] place-items-center bg-[#fbfbfb] px-5 text-center text-[#141414]">
        <section>
          <span className="text-sm font-bold text-[#777777]">NO ROOM SELECTED</span>
          <h1 className="mt-4 text-3xl font-extrabold">선택된 방이 없습니다</h1>
          <p className="mt-4 text-base text-[#777777]">먼저 /rooms에서 샘플 방을 선택한 뒤 편집 화면으로 이동해 주세요.</p>
        </section>
      </main>
    );
  }

  const warnings = validationResult?.warnings ?? [];
  const selectedFurniture = selectedFurnitureId
    ? roomLayout.furniture.find((item) => item.id === selectedFurnitureId && item.status !== "deleted")
    : undefined;

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] text-[#141414]">
      <section className="grid min-h-[calc(100vh-76px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative flex min-h-140 flex-col px-6 py-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="min-w-0 truncate text-2xl font-extrabold ml-2">{roomLayout.name}</h1>
              <span className="rounded-full bg-[#eeeeee] px-3 py-1 text-xs font-bold text-[#777777]">
                가구 {roomLayout.furniture.filter((item) => item.status !== "deleted").length}개
              </span>
              <span className="rounded-full bg-[#eeeeee] px-3 py-1 text-xs font-bold text-[#777777]">
                {roomLayout.width}m × {roomLayout.depth}m
              </span>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#dfdfdf] bg-white px-3 py-2 text-sm font-extrabold text-[#333333] transition-colors hover:bg-[#f6f6f6]">
              <input
                type="checkbox"
                checked={hideEntranceWalls}
                onChange={(event) => setHideEntranceWalls(event.target.checked)}
                className="h-4 w-4 accent-[#111111]"
              />
              내부 보기
            </label>
          </div>

          <SelectedFurnitureActions
            selectedFurnitureId={selectedFurniture?.id ?? null}
            selectedFurnitureName={selectedFurniture?.name}
            onRotate={handleRotateFurniture}
            onDelete={handleDeleteFurniture}
            onUndo={handleUndoFurnitureEdit}
            canUndo={canUndo}
          />

          <div className="manage-room flex-1">
            <RoomViewer
              room={roomLayout}
              furniture={roomLayout.furniture.filter((item) => item.status !== "deleted")}
              selectedFurnitureId={selectedFurnitureId}
              onSelectFurniture={setSelectedFurnitureId}
              onMoveFurniture={handleMoveFurniture}
              onBeginMoveFurniture={handleBeginMoveFurniture}
              onEndMoveFurniture={handleEndMoveFurniture}
              hideEntranceWalls={hideEntranceWalls}
              alignCameraToEntrance
              showEditingHelpers
              preferredColorTone={preferredColorTone}
            />
          </div>
        </section>

        <aside className="space-y-5 border-t border-[#eeeeee] bg-[#fbfbfb] p-5 lg:border-l lg:border-t-0">
          <EditorFeedbackPanel
            layoutReady={Boolean(layoutId)}
            feedback={feedback}
            isApplyingFeedback={isApplyingFeedback}
            isRecommending={isRecommending}
            result={feedbackResult}
            onFeedbackChange={setFeedback}
            onApplyFeedback={handleFeedback}
            onRecommend={handleRecommend}
          />

          {recommendationNotice && (
            <RecommendationResultPanel
              notice={recommendationNotice}
              onReturnToFurniture={() => navigate("/add-furniture", { state: location.state })}
            />
          )}

          {interpretedIntent && (
            <section className="rounded-xl border border-[#dfe8ff] bg-[#f7f9ff] p-5">
              <h2 className="text-lg font-extrabold">LLM 해석 결과</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <InfoItem label="source" value={interpretedIntent.source ?? "-"} />
                <InfoItem label="intent" value={interpretedIntent.rawIntent ?? "-"} />
                <InfoItem label="target" value={interpretedIntent.targetFurniture ?? "-"} />
                <InfoItem label="fallback" value={String(interpretedIntent.fallbackUsed ?? false)} />
              </dl>
            </section>
          )}

          {scoreSummary && recommendationNotice?.status !== "FAILED" && (
            <ScoreSummaryPanel
              scoreSummary={scoreSummary}
              recommendationStatus={recommendationNotice?.status}
            />
          )}

          {validationResult && (
            <section data-editor-section="validation" className="rounded-xl border border-[#e6e6e6] bg-white p-5">
              <h2 className="text-lg font-extrabold">검증 결과</h2>
              <div className="mt-4 space-y-2 text-sm font-semibold">
                <CheckLine label="충돌 없음" ok={validationResult.collisionFree} />
                <CheckLine label="방 경계 내 배치" ok={validationResult.boundaryValid} />
                <CheckLine label="문 앞 공간 확보" ok={validationResult.doorClearance} />
                <CheckLine label="창문 앞 공간 확보" ok={validationResult.windowClearance} />
                <CheckLine label="이동 동선 확보" ok={validationResult.pathSecured} />
              </div>

              {warnings.length > 0 && (
                <div className="mt-4 rounded-xl bg-[#fff8e6] p-4">
                  <strong className="text-sm font-extrabold text-[#9a6500]">경고</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-[#8a5a00]">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {errorMessage && (
            <section role="alert" className="rounded-xl border border-[#ffd8d8] bg-[#fff5f5] p-5 text-sm font-bold text-[#c0392b]">
              {errorMessage}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

function markUserModified(item: Furniture): Furniture {
  return item.status === "deleted" ? item : { ...item, status: "user_modified" };
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-bold text-[#777777]">{label}</dt>
      <dd className="font-extrabold text-[#111111]">{value}</dd>
    </div>
  );
}

function CheckLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={ok ? "text-[#16803a]" : "text-[#d35400]"}>{ok ? "양호" : "경고"}</span>
    </div>
  );
}
