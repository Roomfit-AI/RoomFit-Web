import { useCallback, useEffect, useRef, useState } from "react";
import { FiRotateCcw, FiTrash2 } from "react-icons/fi";

import { applyLayoutFeedback, createDefaultAgentContext, recommendLayout, type InterpretedIntent, type LayoutValidationResult, type ScoreSummary } from "../api/layouts";
import {
  clearActiveLayoutSaveStateIfOwned,
  discardPersistedActiveLayoutDraft,
  enqueueActiveLayoutSave,
  flushActiveLayoutSave,
  getActiveLayoutSaveState,
  getPersistedActiveLayoutDraft,
  recoverActiveLayoutSave,
  setActiveLayoutSession,
  subscribeActiveLayoutSaveResults,
  useActiveLayoutSaveState,
  type PersistedLayoutSaveDraft,
} from "../api/layoutSaveCoordinator";
import { discardConfirmedLayoutStaleState, isLayoutSessionConfirmed } from "../api/layoutConfirmation";
import {
  clearActiveRoomFurnitureSaveStateIfOwned,
  flushActiveRoomFurnitureSave,
  getActiveRoomFurnitureSaveState,
  getPersistedRoomFurnitureSaveDraft,
  recoverActiveRoomFurnitureSave,
  setActiveRoomFurnitureSaveSession,
} from "../api/roomFurnitureSaveCoordinator";
import {
  clearLayoutSession,
  hasSameLayoutOwnership,
  isLayoutSessionOwnedBy,
  isLayoutOwnershipForRoom,
  readLayoutSession,
  readOrMigrateLayoutSession,
  readSelectedBackendRoomId,
  toLayoutSession,
  writeLayoutSession,
  type BackendRoomId,
  type LayoutSession,
} from "../api/layoutSession";
import {
  assertActiveLayoutEditingAllowed,
  beginActiveLayoutWorkflow,
  endActiveLayoutWorkflow,
  isActiveLayoutWorkflowCurrent,
  useActiveLayoutWorkflowState,
  type ActiveLayoutWorkflowKind,
  type ActiveLayoutWorkflowToken,
} from "../api/layoutWorkflow";
import { applyBackendFurnitureToLayout, type BackendFurnitureApiItem } from "../api/rooms";
import { readSelectedRoomEnvelope } from "../api/roomSelectionStorage";
import { safeStorageSet } from "../api/safeStorage";
import RoomViewer from "../components/room/RoomViewer";
import { getLiveMirrorForSelectedRoom } from "../config/confirmedLayouts";
import type { RoomLayout, Vector2D } from "../types";

// The room as saved from /manage-furniture, unmodified. Used by
// handleResetFurniture's "초기화" button, which needs the true untouched
// baseline to discard edits back to — not whatever's currently on screen.
function loadSelectedRoomLayout(): RoomLayout | null {
  const selected = readSelectedRoomEnvelope();
  return selected.status === "valid" ? selected.selection.roomLayout : null;
}

// What the editor should actually open showing: the live mirror (every
// edit made in /editor this session, whether formally confirmed or not) if
// this room already has one, so navigating away (e.g. to /layout-confirm)
// and back — via "이전 단계" or otherwise — doesn't appear to "reset" the
// room back to its untouched baseline. Falls back to the true baseline only
// the very first time a room is opened this session.
interface InitialEditorState {
  roomLayout: RoomLayout | null;
  layoutSession: LayoutSession | null;
  ownerBackendRoomId: BackendRoomId | null;
  pendingDraft: PersistedLayoutSaveDraft | null;
  migrateLegacySnapshot: boolean;
  recoveryError: string;
}

function loadInitialEditorState(): InitialEditorState {
  try {
    return loadInitialEditorStateUnsafe();
  } catch (error) {
    console.warn("편집기 저장 상태를 읽지 못해 안전한 초기 상태로 시작합니다.", error);
    return {
      roomLayout: loadSelectedRoomLayout(),
      layoutSession: null,
      ownerBackendRoomId: readSelectedBackendRoomId(),
      pendingDraft: null,
      migrateLegacySnapshot: false,
      recoveryError: "브라우저 저장 정보를 읽지 못해 이전 미저장 배치를 복구하지 않았습니다.",
    };
  }
}

function loadInitialEditorStateUnsafe(): InitialEditorState {
  const liveLayout = getLiveMirrorForSelectedRoom();
  let roomLayout = liveLayout ?? loadSelectedRoomLayout();
  const ownerBackendRoomId = readSelectedBackendRoomId();

  if (!roomLayout || !ownerBackendRoomId) {
    return {
      roomLayout,
      layoutSession: null,
      ownerBackendRoomId,
      pendingDraft: null,
      migrateLegacySnapshot: false,
      recoveryError: "",
    };
  }

  const lookup = readOrMigrateLayoutSession(ownerBackendRoomId, roomLayout.id);
  let layoutSession = lookup.session;
  let migrateLegacySnapshot = lookup.migratedFromLegacy;
  let recoveryError = "";

  if (migrateLegacySnapshot && !liveLayout) {
    clearLayoutSession();
    layoutSession = null;
    migrateLegacySnapshot = false;
    recoveryError = "편집 이력이 없는 이전 배치 세션을 안전하게 정리했습니다.";
  }

  if (layoutSession && !isLayoutSessionOwnedBy(layoutSession, ownerBackendRoomId, roomLayout.id)) {
    clearLayoutSession();
    layoutSession = null;
    recoveryError = "현재 방과 일치하지 않는 이전 배치 세션을 무시했습니다.";
  }

  let pendingDraft = getPersistedActiveLayoutDraft();

  if (pendingDraft) {
    const matchesRoom = isLayoutOwnershipForRoom(pendingDraft, ownerBackendRoomId, roomLayout.id);
    const matchesSession = !layoutSession || hasSameLayoutOwnership(pendingDraft, layoutSession);
    if (!matchesRoom || !matchesSession) {
      discardPersistedActiveLayoutDraft(pendingDraft);
      pendingDraft = null;
      recoveryError = "현재 방과 일치하지 않는 미저장 배치를 안전하게 폐기했습니다.";
    }
  }

  const confirmationCandidate = layoutSession ?? (pendingDraft ? toLayoutSession(pendingDraft) : null);
  if (confirmationCandidate) {
    const cleanup = discardConfirmedLayoutStaleState(confirmationCandidate, {
      clearCoordinator: () => discardConfirmedEditorState(confirmationCandidate, pendingDraft),
      clearSession: clearLayoutSession,
    });
    if (cleanup.confirmed) {
      if (!cleanup.complete) {
        console.warn("확정된 이전 배치 상태를 일부 정리하지 못했습니다.", cleanup.warnings);
      }
      layoutSession = null;
      pendingDraft = null;
      recoveryError = "이미 확정된 이전 배치 세션을 다시 저장하지 않도록 정리했습니다.";
    }
  }

  if (pendingDraft) {
    layoutSession ??= toLayoutSession(pendingDraft);
    writeLayoutSession(layoutSession);
    roomLayout = pendingDraft.roomLayout;
    recoveryError = "";
  }

  return {
    roomLayout,
    layoutSession,
    ownerBackendRoomId,
    pendingDraft,
    migrateLegacySnapshot: migrateLegacySnapshot && !pendingDraft,
    recoveryError,
  };
}

function discardConfirmedEditorState(
  session: LayoutSession,
  pendingDraft: PersistedLayoutSaveDraft | null,
): boolean {
  const activeSession = getActiveLayoutSaveState().session;
  if (activeSession && hasSameLayoutOwnership(activeSession, session)) {
    return clearActiveLayoutSaveStateIfOwned(session);
  }
  if (pendingDraft && hasSameLayoutOwnership(pendingDraft, session)) {
    return discardPersistedActiveLayoutDraft(pendingDraft);
  }
  return true;
}

function persistRoomLayout(layout: RoomLayout): void {
  const result = safeStorageSet("local", "roomfit:confirmedRoomLayout", JSON.stringify(layout));
  if (result.status === "storage-error") {
    console.warn("배치 live mirror를 저장하지 못했습니다. persisted draft로 복구합니다.", result.error);
  }
}

function applyLayoutUpdateResult(layout: RoomLayout, furniture: BackendFurnitureApiItem[]): RoomLayout {
  const backendLayout = applyBackendFurnitureToLayout(layout, furniture);
  const currentById = new Map(layout.furniture.map((item) => [item.id, item]));

  return {
    ...layout,
    furniture: backendLayout.furniture.map((backendItem) => {
      const currentItem = currentById.get(backendItem.id);

      if (!currentItem) {
        throw new Error(`Backend returned an unknown furniture id: ${backendItem.id}`);
      }

      return {
        ...currentItem,
        dimensions: backendItem.dimensions,
        position: backendItem.position,
        rotationY: backendItem.rotationY,
        status: backendItem.status,
      };
    }),
  };
}

function hasSameNullableLayoutSession(
  first: LayoutSession | null,
  second: LayoutSession | null,
): boolean {
  if (!first || !second) {
    return first === second;
  }
  return hasSameLayoutOwnership(first, second);
}

export default function EditorPlaceholder() {
  const [initialEditorState] = useState(loadInitialEditorState);
  const [roomLayout, setRoomLayout] = useState<RoomLayout | null>(initialEditorState.roomLayout);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState<number | null>(initialEditorState.layoutSession?.layoutId ?? null);
  const [feedback, setFeedback] = useState("");
  const [hideEntranceWalls, setHideEntranceWalls] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [isApplyingFeedback, setIsApplyingFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialEditorState.recoveryError);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [validationResult, setValidationResult] = useState<LayoutValidationResult | null>(null);
  const [interpretedIntent, setInterpretedIntent] = useState<InterpretedIntent | null>(null);
  const layoutSaveState = useActiveLayoutSaveState();
  const layoutWorkflowState = useActiveLayoutWorkflowState();
  const roomLayoutRef = useRef(roomLayout);
  const layoutIdRef = useRef(layoutId);
  const recoveryStartedRef = useRef(false);
  const mountedRef = useRef(true);
  const editorWorkflowRef = useRef<ActiveLayoutWorkflowToken | null>(null);
  const workflowAbortRef = useRef<AbortController | null>(null);

  const replaceRoomLayout = useCallback((nextLayout: RoomLayout) => {
    roomLayoutRef.current = nextLayout;
    setRoomLayout(nextLayout);
    persistRoomLayout(nextLayout);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      workflowAbortRef.current?.abort();
      if (editorWorkflowRef.current) {
        endActiveLayoutWorkflow(editorWorkflowRef.current);
        editorWorkflowRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!layoutId) {
      return undefined;
    }

    return subscribeActiveLayoutSaveResults(({ revision, session, response }) => {
      const currentSaveState = getActiveLayoutSaveState();
      if (
        session.layoutId !== layoutIdRef.current
        || !currentSaveState.session
        || !hasSameLayoutOwnership(currentSaveState.session, session)
        || revision !== currentSaveState.latestRevision
      ) {
        return;
      }

      const currentLayout = roomLayoutRef.current;
      if (!currentLayout) {
        return;
      }

      try {
        replaceRoomLayout(applyLayoutUpdateResult(currentLayout, response.recommendedFurniture));
        setScoreSummary(response.scoreSummary);
        setValidationResult(response.validationResult);
      } catch (error) {
        console.error("저장 응답을 현재 편집 상태에 반영하지 못했습니다.", error);
        setErrorMessage("서버 저장 응답이 현재 가구 목록과 일치하지 않아 화면에 반영하지 않았습니다.");
      }
    });
  }, [layoutId, replaceRoomLayout]);

  useEffect(() => {
    if (recoveryStartedRef.current) {
      return;
    }
    recoveryStartedRef.current = true;

    const session = initialEditorState.layoutSession;
    const layout = initialEditorState.roomLayout;
    const ownerBackendRoomId = initialEditorState.ownerBackendRoomId;

    if (!session || !layout || !ownerBackendRoomId) {
      return;
    }

    try {
      setActiveLayoutSession(session);
      const recovery = recoverActiveLayoutSave();
      if (initialEditorState.migrateLegacySnapshot && recovery.status !== "recovered") {
        enqueueActiveLayoutSave(layout);
      }
    } catch (error) {
      console.error("미저장 배치를 복구하지 못했습니다.", error);
      queueMicrotask(() => setErrorMessage("미저장 배치를 안전하게 복구하지 못했습니다."));
    }
  }, [initialEditorState]);

  const commitEditedLayout = (nextLayout: RoomLayout) => {
    try {
      assertActiveLayoutEditingAllowed();
      const currentLayoutId = layoutIdRef.current;
      if (!currentLayoutId) {
        replaceRoomLayout(nextLayout);
        setErrorMessage("");
        return true;
      }

      const ownerBackendRoomId = readSelectedBackendRoomId();
      const storedSession = readLayoutSession();
      const activeSession = getActiveLayoutSaveState().session;
      if (storedSession && activeSession && !hasSameLayoutOwnership(storedSession, activeSession)) {
        throw new Error("Stored and active layout sessions do not match");
      }
      const session = storedSession ?? activeSession;

      if (
        !ownerBackendRoomId
        || !session
        || session.layoutId !== currentLayoutId
        || !isLayoutSessionOwnedBy(session, ownerBackendRoomId, nextLayout.id)
      ) {
        throw new Error("Current room does not own the active layout session");
      }

      writeLayoutSession(session);
      setActiveLayoutSession(session);
      enqueueActiveLayoutSave(nextLayout);
      replaceRoomLayout(nextLayout);
      setErrorMessage("");
      return true;
    } catch (error) {
      console.error("배치 저장 요청을 등록하지 못했습니다.", error);
      setErrorMessage("편집 내용을 저장할 준비가 되지 않아 화면에 반영하지 않았습니다.");
      return false;
    }
  };

  const handleMoveFurniture = (id: string, position: Vector2D) => {
    const currentLayout = roomLayoutRef.current;
    const target = currentLayout?.furniture.find((item) => item.id === id);

    if (!currentLayout || !target || target.status === "deleted") {
      return;
    }

    commitEditedLayout({
      ...currentLayout,
      furniture: currentLayout.furniture.map((item) => item.id === id
        ? { ...item, position, status: "user_modified" }
        : item),
    });
  };

  const handleRotateFurniture = (id: string) => {
    const currentLayout = roomLayoutRef.current;
    const target = currentLayout?.furniture.find((item) => item.id === id);

    if (!currentLayout || !target || target.status === "deleted") {
      return;
    }

    commitEditedLayout({
      ...currentLayout,
      furniture: currentLayout.furniture.map((item) => item.id === id
        ? { ...item, rotationY: item.rotationY + Math.PI / 2, status: "user_modified" }
        : item),
    });
  };

  const handleDeleteFurniture = (id: string) => {
    const currentLayout = roomLayoutRef.current;
    const target = currentLayout?.furniture.find((item) => item.id === id);

    if (!currentLayout || !target || target.status === "deleted") {
      return;
    }

    const applied = commitEditedLayout({
      ...currentLayout,
      furniture: currentLayout.furniture.map((item) => item.id === id ? { ...item, status: "deleted" } : item),
    });
    if (applied) {
      setSelectedFurnitureId(null);
    }
  };

  // Resets to whatever is currently saved under roomfit:selectedRoomLayout
  // (the furniture as last saved from /manage-furniture) rather than the
  // room's original as-uploaded furniture — AI recommendations/feedback and
  // manual drag/rotate edits made here never write back to that key, so
  // re-reading it always gives the furniture-management baseline.
  const handleResetFurniture = () => {
    const saved = loadSelectedRoomLayout();

    if (!saved) {
      return;
    }

    const currentLayout = roomLayoutRef.current;
    if (!currentLayout) {
      return;
    }

    if (!layoutIdRef.current) {
      if (commitEditedLayout({ ...currentLayout, furniture: saved.furniture })) {
        setSelectedFurnitureId(null);
      }
      return;
    }

    const savedById = new Map(saved.furniture.map((item) => [item.id, item]));
    const applied = commitEditedLayout({
      ...currentLayout,
      furniture: currentLayout.furniture.map((item) => savedById.get(item.id) ?? { ...item, status: "deleted" }),
    });
    if (applied) {
      setSelectedFurnitureId(null);
    }
  };

  const readConsistentSession = (): LayoutSession | null => {
    const storedSession = readLayoutSession();
    const activeSession = getActiveLayoutSaveState().session;
    if (storedSession && activeSession && !hasSameLayoutOwnership(storedSession, activeSession)) {
      throw new Error("Stored and active layout sessions do not match");
    }
    return storedSession ?? activeSession;
  };

  const startEditorWorkflow = (
    kind: ActiveLayoutWorkflowKind,
    expectedSession: LayoutSession | null,
  ) => {
    const token = beginActiveLayoutWorkflow(kind, expectedSession);
    const controller = new AbortController();
    editorWorkflowRef.current = token;
    workflowAbortRef.current = controller;
    return { token, controller };
  };

  const finishEditorWorkflow = (token: ActiveLayoutWorkflowToken) => {
    endActiveLayoutWorkflow(token);
    if (editorWorkflowRef.current?.revision === token.revision) {
      editorWorkflowRef.current = null;
      workflowAbortRef.current = null;
    }
  };

  const isEditorWorkflowCurrent = (
    token: ActiveLayoutWorkflowToken,
    expectedSession: LayoutSession | null,
    ownerBackendRoomId: number,
    ownerUiRoomLayoutId: string,
  ) => {
    const selected = readSelectedRoomEnvelope();
    return mountedRef.current
      && readSelectedBackendRoomId() === ownerBackendRoomId
      && selected.status === "valid"
      && selected.selection.uiRoomLayoutId === ownerUiRoomLayoutId
      && isActiveLayoutWorkflowCurrent(token, expectedSession)
      && hasSameNullableLayoutSession(getActiveLayoutSaveState().session, expectedSession);
  };

  const installLayoutResult = (
    nextSession: LayoutSession,
    nextLayout: RoomLayout,
  ) => {
    const previousStoredSession = readLayoutSession();
    const previousActiveSession = getActiveLayoutSaveState().session;

    if (isLayoutSessionConfirmed(nextSession)) {
      throw new Error("Cannot install an already confirmed layout session");
    }

    try {
      writeLayoutSession(nextSession);
      const previousSession = previousStoredSession ?? previousActiveSession;
      const draftCleared = previousSession
        ? clearActiveLayoutSaveStateIfOwned(previousSession)
        : true;
      if (!draftCleared) {
        console.warn("이전 배치 draft를 제거하지 못해 다음 복구 시 owner 기준으로 폐기합니다.");
      }
      setActiveLayoutSession(nextSession);
      replaceRoomLayout(nextLayout);
      layoutIdRef.current = nextSession.layoutId;
      setLayoutId(nextSession.layoutId);
    } catch (error) {
      const previousSession = previousStoredSession ?? previousActiveSession;
      try {
        if (previousSession) {
          writeLayoutSession(previousSession);
          if (!getActiveLayoutSaveState().session && !isLayoutSessionConfirmed(previousSession)) {
            setActiveLayoutSession(previousSession);
          }
        } else {
          clearLayoutSession();
        }
      } catch (restoreError) {
        console.error("새 배치 설치 실패 후 이전 세션을 복원하지 못했습니다.", restoreError);
      }
      throw error;
    }
  };

  const handleRecommend = async () => {
    const currentLayout = roomLayoutRef.current;
    if (!currentLayout) {
      setErrorMessage("먼저 /rooms에서 샘플 방을 선택해 주세요.");
      return;
    }

    const ownerBackendRoomId = readSelectedBackendRoomId();
    if (!ownerBackendRoomId) {
      setErrorMessage("현재 선택된 백엔드 방 ID를 확인할 수 없습니다.");
      return;
    }

    let expectedSession: LayoutSession | null;
    try {
      expectedSession = readConsistentSession();
      if (expectedSession && !isLayoutSessionOwnedBy(expectedSession, ownerBackendRoomId, currentLayout.id)) {
        throw new Error("Current room does not own the layout session");
      }
    } catch (error) {
      console.error("추천 전 배치 세션을 확인하지 못했습니다.", error);
      setErrorMessage("현재 방의 배치 세션을 확인할 수 없어 추천을 시작하지 않았습니다.");
      return;
    }

    let workflow: ReturnType<typeof startEditorWorkflow>;
    try {
      workflow = startEditorWorkflow("recommend", expectedSession);
    } catch (error) {
      console.error("다른 배치 작업이 진행 중입니다.", error);
      setErrorMessage("다른 배치 작업이 끝난 뒤 다시 시도해 주세요.");
      return;
    }

    setIsRecommending(true);
    setErrorMessage("");
    setInterpretedIntent(null);

    try {
      if (expectedSession) {
        setActiveLayoutSession(expectedSession);
        recoverActiveLayoutSave();
        await flushActiveLayoutSave();
      }

      let activeRoomSave = getActiveRoomFurnitureSaveState().session;
      const roomDraft = getPersistedRoomFurnitureSaveDraft();
      if (!activeRoomSave && roomDraft) {
        if (
          roomDraft.ownerBackendRoomId !== ownerBackendRoomId
          || roomDraft.ownerUiRoomLayoutId !== currentLayout.id
        ) {
          throw new Error("Current room does not own the persisted Room draft");
        }
        setActiveRoomFurnitureSaveSession({
          ownerBackendRoomId,
          ownerUiRoomLayoutId: currentLayout.id,
        });
        const recovery = recoverActiveRoomFurnitureSave();
        if (recovery.status === "recovered") {
          replaceRoomLayout(recovery.snapshot);
        }
        activeRoomSave = getActiveRoomFurnitureSaveState().session;
      }
      if (
        activeRoomSave
        && (activeRoomSave.ownerBackendRoomId !== ownerBackendRoomId
          || activeRoomSave.ownerUiRoomLayoutId !== currentLayout.id)
      ) {
        throw new Error("Current room does not own the active Room save");
      }
      await flushActiveRoomFurnitureSave();
      if (activeRoomSave) {
        clearActiveRoomFurnitureSaveStateIfOwned(activeRoomSave);
      }

      if (!isEditorWorkflowCurrent(workflow.token, expectedSession, ownerBackendRoomId, currentLayout.id)) {
        return;
      }
      const stableLayout = roomLayoutRef.current ?? currentLayout;

      const context = await createDefaultAgentContext(ownerBackendRoomId, workflow.controller.signal);
      const result = await recommendLayout(ownerBackendRoomId, context.contextId, workflow.controller.signal);
      if (!isEditorWorkflowCurrent(workflow.token, expectedSession, ownerBackendRoomId, currentLayout.id)) {
        return;
      }

      const nextLayout = applyBackendFurnitureToLayout(stableLayout, result.recommendedFurniture);
      const nextSession: LayoutSession = {
        version: 1,
        layoutId: result.layoutId,
        ownerBackendRoomId,
        ownerUiRoomLayoutId: nextLayout.id,
      };

      installLayoutResult(nextSession, nextLayout);
      setScoreSummary(result.scoreSummary);
      setValidationResult(result.validationResult);
    } catch (error) {
      console.error(error);
      if (mountedRef.current && isActiveLayoutWorkflowCurrent(workflow.token)) {
        setErrorMessage("AI 추천 생성에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.");
      }
    } finally {
      finishEditorWorkflow(workflow.token);
      if (mountedRef.current) {
        setIsRecommending(false);
      }
    }
  };

  const handleFeedback = async () => {
    const currentLayout = roomLayoutRef.current;
    const currentLayoutId = layoutIdRef.current;
    const ownerBackendRoomId = readSelectedBackendRoomId();
    let session: LayoutSession | null;
    try {
      session = readConsistentSession();
    } catch (error) {
      console.error("피드백 전 배치 세션을 확인하지 못했습니다.", error);
      setErrorMessage("현재 방과 배치 세션이 일치하지 않아 피드백을 적용할 수 없습니다.");
      return;
    }

    if (!currentLayout) {
      setErrorMessage("먼저 /rooms에서 샘플 방을 선택해 주세요.");
      return;
    }

    if (!currentLayoutId) {
      setErrorMessage("먼저 AI 추천 생성을 실행해 주세요.");
      return;
    }

    if (
      !ownerBackendRoomId
      || !session
      || session.layoutId !== currentLayoutId
      || !isLayoutSessionOwnedBy(session, ownerBackendRoomId, currentLayout.id)
    ) {
      setErrorMessage("현재 방과 배치 세션이 일치하지 않아 피드백을 적용할 수 없습니다.");
      return;
    }

    if (!feedback.trim()) {
      setErrorMessage("피드백을 입력해 주세요.");
      return;
    }

    let workflow: ReturnType<typeof startEditorWorkflow>;
    try {
      workflow = startEditorWorkflow("feedback", session);
    } catch (error) {
      console.error("다른 배치 작업이 진행 중입니다.", error);
      setErrorMessage("다른 배치 작업이 끝난 뒤 다시 시도해 주세요.");
      return;
    }

    setIsApplyingFeedback(true);
    setErrorMessage("");

    try {
      setActiveLayoutSession(session);
      recoverActiveLayoutSave();
      await flushActiveLayoutSave();
      if (!isEditorWorkflowCurrent(workflow.token, session, ownerBackendRoomId, currentLayout.id)) {
        return;
      }
      const stableLayout = roomLayoutRef.current ?? currentLayout;

      const result = await applyLayoutFeedback(
        currentLayoutId,
        feedback.trim(),
        workflow.controller.signal,
      );
      if (!isEditorWorkflowCurrent(workflow.token, session, ownerBackendRoomId, currentLayout.id)) {
        return;
      }

      const nextLayout = applyBackendFurnitureToLayout(stableLayout, result.recommendedFurniture);
      const nextSession: LayoutSession = {
        version: 1,
        layoutId: result.layoutId,
        ownerBackendRoomId,
        ownerUiRoomLayoutId: nextLayout.id,
      };

      installLayoutResult(nextSession, nextLayout);
      setScoreSummary(result.scoreSummary);
      setValidationResult(result.validationResult);
      setInterpretedIntent(result.interpretedIntent ?? null);

    } catch (error) {
      console.error(error);
      if (mountedRef.current && isActiveLayoutWorkflowCurrent(workflow.token)) {
        setErrorMessage("피드백 반영에 실패했습니다. 지원하지 않는 피드백이거나 서버 요청이 실패했을 수 있습니다.");
      }
    } finally {
      finishEditorWorkflow(workflow.token);
      if (mountedRef.current) {
        setIsApplyingFeedback(false);
      }
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
  const visibleFurniture = roomLayout.furniture.filter((item) => item.status !== "deleted");
  const isEditorWorkflowLocked = layoutWorkflowState.kind !== "idle";
  const layoutSaveErrorMessage = layoutId
    && layoutSaveState.session?.layoutId === layoutId
    && layoutSaveState.error
    ? "배치를 저장하지 못했습니다. 최신 편집 상태는 유지되며 다음 단계에서 다시 저장을 시도합니다."
    : "";

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] text-[#141414]">
      <section className="grid min-h-[calc(100vh-76px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative flex min-h-140 flex-col px-6 py-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="min-w-0 truncate text-2xl font-extrabold ml-2">{roomLayout.name}</h1>
              <span className="rounded-full bg-[#eeeeee] px-3 py-1 text-xs font-bold text-[#777777]">
                가구 {visibleFurniture.length}개
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

          <div className="manage-room flex-1">
            <RoomViewer
              room={roomLayout}
              furniture={roomLayout.furniture}
              selectedFurnitureId={selectedFurnitureId}
              onSelectFurniture={setSelectedFurnitureId}
              onMoveFurniture={isEditorWorkflowLocked ? () => undefined : handleMoveFurniture}
              hideEntranceWalls={hideEntranceWalls}
              alignCameraToEntrance
              showEditingHelpers
            />
          </div>

          <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.08)]">
            <EditorToolButton
              label="90° 회전"
              icon={<span className="text-[11px] font-extrabold leading-none">90°</span>}
              onClick={!isEditorWorkflowLocked && selectedFurnitureId ? () => handleRotateFurniture(selectedFurnitureId) : undefined}
            />
            <EditorToolButton
              label="가구 삭제"
              icon={<FiTrash2 />}
              onClick={!isEditorWorkflowLocked && selectedFurnitureId ? () => handleDeleteFurniture(selectedFurnitureId) : undefined}
            />
            <EditorToolButton label="초기화" icon={<FiRotateCcw />} onClick={isEditorWorkflowLocked ? undefined : handleResetFurniture} />
          </div>
        </section>

        <aside className="space-y-5 border-t border-[#eeeeee] bg-[#fbfbfb] p-5 lg:border-l lg:border-t-0">
          <section className="rounded-xl border border-[#e6e6e6] bg-white p-5">
            <h2 className="text-lg font-extrabold">AI 피드백</h2>
            {!layoutId ? (
              <div className="mt-4 rounded-lg border border-dashed border-[#d8d8d8] bg-[#f7f7f7] p-4">
                <strong className="block text-sm font-extrabold text-[#333333]">먼저 AI 추천 배치를 생성해 주세요</strong>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#777777]">
                  추천 배치가 만들어진 뒤에 원하는 변경사항을 피드백으로 반영할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={handleRecommend}
                  disabled={isRecommending || isEditorWorkflowLocked}
                  className="mt-4 w-full rounded-lg bg-[#111111] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#999999]"
                >
                  {isRecommending ? "AI 추천 생성 중..." : "AI 추천 생성하기"}
                </button>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm font-medium leading-6 text-[#777777]">
                  자연어 피드백을 LLM이 intent로 해석하고, 백엔드 규칙 기반 로직이 배치에 반영합니다.
                </p>

                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  disabled={isEditorWorkflowLocked}
                  className="mt-4 min-h-28 w-full resize-none rounded-lg border border-[#dddddd] bg-[#fbfbfb] p-4 text-sm font-semibold outline-none focus:border-[#111111]"
                  placeholder="(예) 책상을 조금 더 넓게 쓰고 싶어"
                />

                <button
                  type="button"
                  onClick={handleFeedback}
                  disabled={isApplyingFeedback || isEditorWorkflowLocked}
                  className="mt-3 w-full rounded-lg bg-[#111111] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#bbbbbb]"
                >
                  {isApplyingFeedback ? "피드백 반영 중..." : "피드백 반영"}
                </button>
              </>
            )}
          </section>

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

          {scoreSummary && (
            <section className="rounded-xl border border-[#e6e6e6] bg-white p-5">
              <h2 className="text-lg font-extrabold">배치 점수</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Score label="충돌" value={scoreSummary.collisionScore} />
                <Score label="경계" value={scoreSummary.boundaryScore} />
                <Score label="동선" value={scoreSummary.pathScore} />
                <Score label="총점" value={scoreSummary.totalScore} />
              </div>
            </section>
          )}

          {validationResult && (
            <section className="rounded-xl border border-[#e6e6e6] bg-white p-5">
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

          {layoutSaveErrorMessage && (
            <section className="rounded-xl border border-[#ffd8d8] bg-[#fff5f5] p-5 text-sm font-bold text-[#c0392b]">
              {layoutSaveErrorMessage}
            </section>
          )}

          {errorMessage && (
            <section className="rounded-xl border border-[#ffd8d8] bg-[#fff5f5] p-5 text-sm font-bold text-[#c0392b]">
              {errorMessage}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-bold text-[#777777]">{label}</dt>
      <dd className="font-extrabold text-[#111111]">{value}</dd>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f7f7f7] p-3">
      <span className="block text-xs font-bold text-[#777777]">{label}</span>
      <strong className="mt-1 block text-lg text-center font-extrabold">{value}</strong>
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

function EditorToolButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={!onClick}
      className="grid h-8 w-8 place-items-center rounded-full text-[#222222] hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
    </button>
  );
}
