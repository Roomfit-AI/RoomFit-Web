import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";
import {
  clearActiveLayoutSaveStateIfOwned,
  discardPersistedActiveLayoutDraft,
  flushActiveLayoutSave,
  getActiveLayoutSaveState,
  getPersistedActiveLayoutDraft,
  recoverActiveLayoutSave,
  setActiveLayoutSession,
  useActiveLayoutSaveState,
  type ActiveLayoutSaveState,
} from "../../api/layoutSaveCoordinator";
import { discardConfirmedLayoutStaleState } from "../../api/layoutConfirmation";
import {
  flushActiveRoomFurnitureSave,
  getActiveRoomFurnitureSaveState,
  getPersistedRoomFurnitureSaveDraft,
  recoverActiveRoomFurnitureSave,
  setActiveRoomFurnitureSaveSession,
  useActiveRoomFurnitureSaveState,
} from "../../api/roomFurnitureSaveCoordinator";
import {
  clearLayoutSessionForLayout,
  hasSameLayoutOwnership,
  isLayoutSessionOwnedBy,
  readLayoutSession,
  writeLayoutSession,
} from "../../api/layoutSession";
import {
  beginActiveLayoutWorkflow,
  endActiveLayoutWorkflow,
  useActiveLayoutWorkflowState,
  type ActiveLayoutWorkflowToken,
} from "../../api/layoutWorkflow";
import { readSelectedRoomEnvelope } from "../../api/roomSelectionStorage";

const navigationSteps = [
  { path: "/", label: "홈" },
  {
    path: "/rooms",
    label: "샘플 선택",
    beforeNext: ensureSelectedRoom,
  },
  { path: "/manage-furniture", label: "가구 관리" },
  { path: "/preference", label: "취향 선택" },
  { path: "/reference-image", label: "이미지 선택" },
  { path: "/add-furniture", label: "가구 선택" },
  { path: "/editor", label: "편집" },
  { path: "/layout-confirm", label: "결과 확인" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentStepIndex = navigationSteps.findIndex((step) => step.path === location.pathname);
  const safeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const isHome = safeStepIndex === 0;
  const isLastStep = safeStepIndex === navigationSteps.length - 1;
  const previousStep = navigationSteps[safeStepIndex - 1];
  const nextStep = navigationSteps[safeStepIndex + 1];
  const [isWaitingForSave, setIsWaitingForSave] = useState(false);
  const [navigationError, setNavigationError] = useState("");
  const navigationPendingRef = useRef(false);
  const layoutSaveState = useActiveLayoutSaveState();
  const roomSaveState = useActiveRoomFurnitureSaveState();
  const layoutWorkflowState = useActiveLayoutWorkflowState();

  const navigateAfterSaving = async (targetPath: string, beforeNavigate?: () => void) => {
    if (navigationPendingRef.current || layoutWorkflowState.kind !== "idle") {
      return;
    }

    let workflowToken: ActiveLayoutWorkflowToken | null = null;
    navigationPendingRef.current = true;
    setIsWaitingForSave(true);
    setNavigationError("");

    try {
      beforeNavigate?.();
      const storedSession = readLayoutSession();
      const activeSession = getActiveLayoutSaveState().session;
      if (storedSession && activeSession && !hasSameLayoutOwnership(storedSession, activeSession)) {
        throw new Error("저장된 배치 세션과 현재 저장 작업이 일치하지 않습니다.");
      }
      const session = storedSession ?? activeSession;
      workflowToken = beginActiveLayoutWorkflow("room-transition", session);

      const selected = readSelectedRoomEnvelope();
      if (selected.status === "storage-error") {
        throw selected.error;
      }
      const ownerBackendRoomId = selected.status === "valid" ? selected.selection.backendRoomId : null;
      const ownerUiRoomLayoutId = selected.status === "valid" ? selected.selection.uiRoomLayoutId : null;
      if (session) {
        if (
          !ownerBackendRoomId
          || !ownerUiRoomLayoutId
          || !isLayoutSessionOwnedBy(session, ownerBackendRoomId, ownerUiRoomLayoutId)
        ) {
          throw new Error("현재 방과 배치 세션이 일치하지 않습니다.");
        }

        const confirmedCleanup = discardConfirmedLayoutStaleState(session, {
          clearCoordinator: () => clearConfirmedLayoutCoordinatorState(session),
          clearSession: () => {
            clearLayoutSessionForLayout(session.layoutId);
          },
        });
        if (!confirmedCleanup.confirmed) {
          writeLayoutSession(session);
          setActiveLayoutSession(session);
          recoverActiveLayoutSave();
          await flushActiveLayoutSave();
        } else if (!confirmedCleanup.complete) {
          console.warn("확정된 배치의 stale 상태를 일부 정리하지 못했습니다.", confirmedCleanup.warnings);
        }
      }

      let activeRoomSave = getActiveRoomFurnitureSaveState().session;
      const roomDraft = getPersistedRoomFurnitureSaveDraft();
      if (!activeRoomSave && roomDraft) {
        if (
          !ownerBackendRoomId
          || !ownerUiRoomLayoutId
          || roomDraft.ownerBackendRoomId !== ownerBackendRoomId
          || roomDraft.ownerUiRoomLayoutId !== ownerUiRoomLayoutId
        ) {
          throw new Error("현재 방과 미저장 Room draft가 일치하지 않습니다.");
        }
        setActiveRoomFurnitureSaveSession({ ownerBackendRoomId, ownerUiRoomLayoutId });
        recoverActiveRoomFurnitureSave();
        activeRoomSave = getActiveRoomFurnitureSaveState().session;
      }
      if (
        activeRoomSave
        && (!ownerBackendRoomId || !ownerUiRoomLayoutId
          || activeRoomSave.ownerBackendRoomId !== ownerBackendRoomId
          || activeRoomSave.ownerUiRoomLayoutId !== ownerUiRoomLayoutId)
      ) {
        throw new Error("현재 방과 Room 저장 작업이 일치하지 않습니다.");
      }
      await flushActiveRoomFurnitureSave();
      const roomSaveAfterFlush = getActiveRoomFurnitureSaveState();
      const layoutAfterRoomSave = readLayoutSession() ?? getActiveLayoutSaveState().session;
      const draftAfterRoomSave = getPersistedActiveLayoutDraft();
      if (
        roomSaveAfterFlush.session
        && roomSaveAfterFlush.latestRevision > 0
        && ((layoutAfterRoomSave && isLayoutSessionOwnedBy(
          layoutAfterRoomSave,
          roomSaveAfterFlush.session.ownerBackendRoomId,
          roomSaveAfterFlush.session.ownerUiRoomLayoutId,
        )) || (draftAfterRoomSave
          && draftAfterRoomSave.ownerBackendRoomId === roomSaveAfterFlush.session.ownerBackendRoomId
          && draftAfterRoomSave.ownerUiRoomLayoutId === roomSaveAfterFlush.session.ownerUiRoomLayoutId))
      ) {
        throw new Error("Room 저장 후 이전 Layout 상태 정리가 완료되지 않았습니다.");
      }
      navigate(targetPath);
    } catch (error) {
      console.error("저장이 완료되지 않아 화면을 이동하지 않았습니다.", error);
      setNavigationError("저장을 완료하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      if (workflowToken) {
        endActiveLayoutWorkflow(workflowToken);
      }
      navigationPendingRef.current = false;
      setIsWaitingForSave(false);
    }
  };

  const goPrevious = () => {
    if (previousStep) {
      void navigateAfterSaving(previousStep.path);
    }
  };

  const goNext = () => {
    const currentStep = navigationSteps[safeStepIndex];
    if (nextStep) {
      void navigateAfterSaving(nextStep.path, currentStep.beforeNext);
    }
  };

  const isNavigationBlocked = isWaitingForSave || layoutWorkflowState.kind !== "idle";
  return (
    <nav className="fixed inset-x-0 top-0 z-30 h-19 border-b border-[#e8e8e8] bg-[#fbfbfb]">
      <div className="flex h-full items-center justify-between px-10">
        <button
          type="button"
          onClick={() => void navigateAfterSaving("/")}
          disabled={isNavigationBlocked}
          className="text-xl font-bold tracking-[0.02em] text-[#181818] transition-opacity hover:opacity-70 sm:text-2xl cursor-pointer"
        >
          ROOMFIT
        </button>

        <div className="flex items-center gap-3">
          {!isHome && previousStep && (
            <button
              type="button"
              onClick={goPrevious}
              disabled={isNavigationBlocked}
              className="hidden items-center justify-center rounded-full border border-[#111111] bg-white px-7 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
            >
              이전 단계
            </button>
          )}

          {/* LayoutConfirm.tsx has its own in-page "확정하기" button inside the
              요약 정보 aside, which also handles the thumbnail capture on
              confirm — keeping this navbar one too just doubled the button. */}
          {nextStep && !isLastStep && (
            <Button onClick={goNext} disabled={isNavigationBlocked} className="hidden px-7 py-2.5 sm:inline-flex">
              {isWaitingForSave
                ? "저장 중..."
                : layoutSaveState.error || roomSaveState.error
                  ? "저장 재시도"
                  : layoutSaveState.hasPending || roomSaveState.hasPending
                    ? "저장 중..."
                  : isHome ? "시작하기" : "다음 단계"}
            </Button>
          )}
        </div>
      </div>
      {navigationError && (
        <p role="alert" className="absolute right-10 top-[calc(100%+8px)] rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#c0392b] shadow">
          {navigationError}
        </p>
      )}
    </nav>
  );
}

function ensureSelectedRoom() {
  const selected = readSelectedRoomEnvelope();
  if (selected.status !== "valid") {
    throw selected.status === "storage-error"
      ? selected.error
      : new Error("먼저 Room을 선택해 주세요.");
  }
}

function clearConfirmedLayoutCoordinatorState(session: NonNullable<ActiveLayoutSaveState["session"]>): boolean {
  const activeSession = getActiveLayoutSaveState().session;
  if (activeSession && hasSameLayoutOwnership(activeSession, session)) {
    return clearActiveLayoutSaveStateIfOwned(session);
  }

  const draft = getPersistedActiveLayoutDraft();
  if (draft && hasSameLayoutOwnership(draft, session)) {
    return discardPersistedActiveLayoutDraft(draft);
  }
  return true;
}
