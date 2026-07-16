import { useEffect, useRef, useState } from "react";
import { FaRug } from "react-icons/fa6";
import { FiCheck, FiChevronDown, FiChevronUp, FiExternalLink, FiHome, FiInfo, FiShoppingBag } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
  MdOutlineBed,
  MdOutlineDesk,
  MdOutlineLibraryBooks,
  MdOutlineLightbulb,
  MdOutlineLocalFlorist,
  MdOutlineWeekend,
} from "react-icons/md";

import { confirmLayout as confirmLayoutOnBackend, getLayoutConfirmErrorDescriptor } from "../api/layouts";
import {
  clearActiveLayoutSaveStateIfOwned,
  flushActiveLayoutSave,
  getActiveLayoutSaveState,
  recoverActiveLayoutSave,
  setActiveLayoutSession,
  useActiveLayoutSaveState,
} from "../api/layoutSaveCoordinator";
import {
  flushActiveRoomFurnitureSave,
  getActiveRoomFurnitureSaveState,
  getPersistedRoomFurnitureSaveDraft,
  recoverActiveRoomFurnitureSave,
  setActiveRoomFurnitureSaveSession,
  useActiveRoomFurnitureSaveState,
} from "../api/roomFurnitureSaveCoordinator";
import {
  beginLayoutConfirmAttempt,
  cleanupConfirmedLayoutLocally,
  isLayoutSessionConfirmed,
  markLayoutConfirmAttemptConfirmed,
  readLayoutConfirmAttempt,
  shouldReconcileAlreadyConfirmed,
} from "../api/layoutConfirmation";
import {
  clearLayoutSessionForLayout,
  hasSameLayoutOwnership,
  isLayoutSessionOwnedBy,
  readLayoutSession,
  readSelectedBackendRoomId,
} from "../api/layoutSession";
import {
  beginActiveLayoutWorkflow,
  endActiveLayoutWorkflow,
  useActiveLayoutWorkflowState,
  type ActiveLayoutWorkflowToken,
} from "../api/layoutWorkflow";
import RoomViewer from "../components/room/RoomViewer";
import PageStepHeader from "../components/ui/PageStepHeader";
import { hasConfirmedLayout, resolveCurrentRoomLayout, saveConfirmedLayout } from "../config/confirmedLayouts";
import { NATURAL_SCENARIO_SHOPPING_LIST } from "../config/naturalScenarioShoppingList";
import { readCurrentPreferences, saveRoomPreferences } from "../config/roomPreferences";
import { captureCanvasThumbnail, saveRoomThumbnail } from "../config/roomThumbnails";
import { currentScenario } from "../config/scenarios";

// Single-glyph icons instead of the .furniture-card-* illustrations — always
// centered within their own viewBox by design, so every row's thumbnail
// lines up the same way regardless of how "top-heavy" or "off-center" that
// particular piece of furniture's shape is.
const SHOPPING_LIST_ICONS: Record<string, typeof MdOutlineBed> = {
  bed: MdOutlineBed,
  plant: MdOutlineLocalFlorist,
  desk: MdOutlineDesk,
  sofa: MdOutlineWeekend,
  lamp: MdOutlineLightbulb,
  bookshelf: MdOutlineLibraryBooks,
  rug: FaRug,
};

export default function LayoutConfirm() {
  const navigate = useNavigate();
  const roomLayout = resolveCurrentRoomLayout();
  const visibleFurniture = roomLayout.furniture.filter((item) => item.status !== "deleted");
  const furnitureCount = visibleFurniture.length;
  // Actual scanned width x depth (matches how Rooms.tsx shows room size on
  // its cards) rather than a computed ㎡ figure — a real width/depth pair
  // like "3.38m x 3.47m" reads as the literal room shape, whereas the
  // rounded ㎡ number collapses distinguishable room shapes down to the same
  // digit and doesn't match anything the user actually recognizes as "their
  // room."
  const roomSize = `${roomLayout.width}m × ${roomLayout.depth}m`;
  const [justConfirmed, setJustConfirmed] = useState(() => {
    const session = readLayoutSession();
    const ownerBackendRoomId = readSelectedBackendRoomId();
    const confirmAttempt = readLayoutConfirmAttempt();
    const markerOwnsCurrentRoom = Boolean(
      confirmAttempt
      && confirmAttempt.status === "confirmed"
      && ownerBackendRoomId
      && confirmAttempt.ownerBackendRoomId === ownerBackendRoomId
      && confirmAttempt.ownerUiRoomLayoutId === roomLayout.id,
    );
    const pendingMarkerOwnsCurrentRoom = Boolean(
      confirmAttempt
      && confirmAttempt.status === "pending"
      && ownerBackendRoomId
      && confirmAttempt.ownerBackendRoomId === ownerBackendRoomId
      && confirmAttempt.ownerUiRoomLayoutId === roomLayout.id,
    );
    const ownsCurrentRoom = Boolean(
      session
      && ownerBackendRoomId
      && isLayoutSessionOwnedBy(session, ownerBackendRoomId, roomLayout.id),
    );
    return !pendingMarkerOwnsCurrentRoom && (markerOwnsCurrentRoom || (ownsCurrentRoom
      ? Boolean(session && isLayoutSessionConfirmed(session))
      : hasConfirmedLayout(roomLayout.id)));
  });
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [isWaitingForSave, setIsWaitingForSave] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [confirmationWarning, setConfirmationWarning] = useState("");
  const roomViewerContainerRef = useRef<HTMLDivElement>(null);
  const confirmationPendingRef = useRef(false);
  const confirmationActionRef = useRef<() => Promise<void>>(async () => undefined);
  const reconciliationStartedRef = useRef(false);
  const layoutSaveState = useActiveLayoutSaveState();
  const roomSaveState = useActiveRoomFurnitureSaveState();
  const layoutWorkflowState = useActiveLayoutWorkflowState();
  const selectedBackendRoomId = readSelectedBackendRoomId();
  const currentLayoutSaveError = layoutSaveState.session
    && selectedBackendRoomId
    && isLayoutSessionOwnedBy(layoutSaveState.session, selectedBackendRoomId, roomLayout.id)
    ? layoutSaveState.error
    : null;
  // Real 오늘의집 product links only exist for the 네츄럴 톤 demo scenario
  // (see naturalScenarioShoppingList.ts) — there's no product-matching
  // backend to look these up generically for any other scenario/room.
  const isNaturalScenario = currentScenario()?.id === "rest-natural-wood";

  const persistConfirmationLocally = (): string[] => {
    const warnings: string[] = [];
    // Local save stays as the source of truth for this session either way
    // (and is the only option for the scripted-scenario path, which has no
    // backend layoutId) — this keeps the result locally, keyed by the room's
    // own id, so reopening this same room later (see Rooms.tsx's selectRoom)
    // picks the confirmed result back up instead of the bare as-uploaded
    // furniture.
    try {
      saveConfirmedLayout(roomLayout.id, roomLayout);
    } catch (error) {
      console.warn("확정된 배치의 로컬 사본을 저장하지 못했습니다.", error);
      warnings.push("layout-copy");
    }

    // Snapshots whatever purpose/palette/style/추가 가구 this room actually
    // used — Rooms.tsx's selectRoom restores this the next time this same
    // room is picked, so reopening a confirmed room shows its own real
    // choices instead of whatever room was selected most recently elsewhere.
    try {
      saveRoomPreferences(roomLayout.id, readCurrentPreferences());
    } catch (error) {
      console.warn("확정된 배치의 취향 정보를 저장하지 못했습니다.", error);
      warnings.push("preferences");
    }

    // /manage-furniture also captures a thumbnail (its "내부 보기" toggle),
    // but that happens early in the flow, before /preference's style pick or
    // /editor's "AI 추천 생성" — so it can only ever be the room's raw,
    // pre-scenario furniture, and never updates again after that. This
    // capture (of the actual final, styled result being confirmed right
    // now) overwrites that with the real final look, so /rooms' thumbnail
    // reflects whichever scenario actually ended up confirmed instead of
    // staying frozen at that one early snapshot.
    try {
      const container = roomViewerContainerRef.current;
      const dataUrl = container && captureCanvasThumbnail(container);
      if (dataUrl) {
        saveRoomThumbnail(roomLayout.id, dataUrl);
      }
    } catch (error) {
      console.warn("확정된 배치의 썸네일을 저장하지 못했습니다.", error);
      warnings.push("thumbnail");
    }
    return warnings;
  };

  const confirmLayout = async () => {
    if (confirmationPendingRef.current || layoutWorkflowState.kind !== "idle") {
      return;
    }

    const ownerBackendRoomId = readSelectedBackendRoomId();
    const storedSession = readLayoutSession();
    const activeSession = layoutSaveState.session;
    if (storedSession && activeSession && !hasSameLayoutOwnership(storedSession, activeSession)) {
      setConfirmationError("저장된 배치 세션과 현재 저장 작업이 일치하지 않습니다. 편집 화면에서 다시 확인해 주세요.");
      return;
    }
    const currentSession = storedSession ?? activeSession;
    if (
      !ownerBackendRoomId
      || !currentSession
      || !isLayoutSessionOwnedBy(currentSession, ownerBackendRoomId, roomLayout.id)
    ) {
      setConfirmationError("현재 방과 일치하는 저장 가능한 배치가 없습니다. 편집 화면에서 추천 배치를 다시 확인해 주세요.");
      return;
    }

    confirmationPendingRef.current = true;
    setIsWaitingForSave(true);
    setConfirmationError("");
    setConfirmationWarning("");
    let workflowToken: ActiveLayoutWorkflowToken | null = null;

    try {
      workflowToken = beginActiveLayoutWorkflow("confirm", currentSession);
      setActiveLayoutSession(currentSession);
      recoverActiveLayoutSave();
      await flushActiveLayoutSave();
      let activeRoomSave = getActiveRoomFurnitureSaveState().session;
      const roomDraft = getPersistedRoomFurnitureSaveDraft();
      if (!activeRoomSave && roomDraft) {
        if (
          roomDraft.ownerBackendRoomId !== ownerBackendRoomId
          || roomDraft.ownerUiRoomLayoutId !== roomLayout.id
        ) {
          throw new Error("현재 방과 미저장 Room draft가 일치하지 않습니다.");
        }
        setActiveRoomFurnitureSaveSession({
          ownerBackendRoomId,
          ownerUiRoomLayoutId: roomLayout.id,
        });
        recoverActiveRoomFurnitureSave();
        activeRoomSave = getActiveRoomFurnitureSaveState().session;
      }
      if (
        activeRoomSave
        && (activeRoomSave.ownerBackendRoomId !== ownerBackendRoomId
          || activeRoomSave.ownerUiRoomLayoutId !== roomLayout.id)
      ) {
        throw new Error("현재 방과 Room 저장 작업이 일치하지 않습니다.");
      }
      await flushActiveRoomFurnitureSave();
      const roomSaveAfterFlush = getActiveRoomFurnitureSaveState();
      if (roomSaveAfterFlush.session && roomSaveAfterFlush.latestRevision > 0) {
        throw new Error("Room furniture changed after the current Layout was created");
      }

      const sessionAfterFlush = readLayoutSession() ?? getActiveLayoutSaveState().session;
      if (!sessionAfterFlush || !hasSameLayoutOwnership(sessionAfterFlush, currentSession)) {
        throw new Error("Room 저장 후 현재 Layout 세션이 무효화되었습니다.");
      }

      beginLayoutConfirmAttempt(currentSession);
      try {
        const confirmation = await confirmLayoutOnBackend(currentSession.layoutId);
        if (!confirmation.confirmed) {
          throw new Error("Backend did not confirm the layout");
        }
      } catch (error) {
        if (!shouldReconcileAlreadyConfirmed(
          currentSession,
          readLayoutConfirmAttempt(),
          getLayoutConfirmErrorDescriptor(error),
        )) {
          throw error;
        }
      }

      const markerResult = markLayoutConfirmAttemptConfirmed(currentSession);
      if (!markerResult.persisted) {
        console.warn("확정 marker는 메모리에 유지되지만 localStorage 저장에는 실패했습니다.");
      }

      const localSnapshotWarnings = persistConfirmationLocally();
      setJustConfirmed(true);

      const warningMessages: string[] = [];
      if (localSnapshotWarnings.length > 0) {
        warningMessages.push("확정은 완료됐지만 일부 로컬 사본을 저장하지 못했습니다.");
      }
      if (markerResult.persisted) {
        const cleanup = cleanupConfirmedLayoutLocally(currentSession, {
          clearCoordinator: () => clearActiveLayoutSaveStateIfOwned(currentSession),
          clearSession: () => {
            clearLayoutSessionForLayout(currentSession.layoutId);
          },
          preserveMarker: localSnapshotWarnings.length > 0,
        });
        if (!cleanup.complete) {
          console.warn("확정은 완료됐지만 일부 로컬 상태를 정리하지 못했습니다.", cleanup.warnings);
          warningMessages.push("확정은 완료됐지만 일부 임시 저장 상태를 정리하지 못했습니다.");
        }
      } else {
        warningMessages.push("확정은 완료됐지만 복구 기록 저장에 실패해 다음 접속에서 상태를 다시 확인합니다.");
      }
      if (warningMessages.length > 0) {
        setConfirmationWarning(warningMessages.join(" "));
      }
    } catch (error) {
      console.error("배치를 저장하거나 확정하지 못했습니다.", error);
      setConfirmationError("배치를 저장하거나 확정하지 못했습니다. 확정하기를 눌러 다시 시도해 주세요.");
    } finally {
      if (workflowToken) {
        endActiveLayoutWorkflow(workflowToken);
      }
      confirmationPendingRef.current = false;
      setIsWaitingForSave(false);
    }
  };

  useEffect(() => {
    confirmationActionRef.current = confirmLayout;
  });
  useEffect(() => {
    if (reconciliationStartedRef.current) {
      return;
    }
    const attempt = readLayoutConfirmAttempt();
    const session = readLayoutSession();
    const ownerBackendRoomId = readSelectedBackendRoomId();
    if (
      attempt?.status !== "pending"
      || !session
      || !ownerBackendRoomId
      || !hasSameLayoutOwnership(attempt, session)
      || !isLayoutSessionOwnedBy(session, ownerBackendRoomId, roomLayout.id)
    ) {
      return;
    }
    reconciliationStartedRef.current = true;
    void confirmationActionRef.current();
  }, [roomLayout.id]);

  return (
    <main className="min-h-[calc(100vh-76px)] overflow-x-hidden bg-[#fbfbfb] px-5 py-7 text-[#111111] sm:px-8 lg:px-10">
      <div
        className={`mx-auto transition-[max-width] duration-500 ease-in-out ${
          showShoppingList ? "max-w-[1620px]" : "max-w-7xl"
        }`}
      >
        {/* The shopping-list aside is a real sibling of 요약 정보 inside this
            same grid/row (not a separate flex block bolted on the side) so
            `lg:items-center` centers both of them against the same row
            height — that's what lines the panel's top edge up with 요약
            정보's instead of the page title further up. The third column's
            own width (0 -> 360px, not display/visibility) is what pushes the
            first column over to make room, and both templates keep the same
            3-track shape so the width itself can transition smoothly. */}
        <div
          className={`grid gap-8 transition-[grid-template-columns] duration-500 ease-in-out lg:items-center ${
            showShoppingList ? "lg:grid-cols-[minmax(0,1fr)_360px_360px]" : "lg:grid-cols-[minmax(0,1fr)_360px_0px]"
          }`}
        >
          <section className="min-w-0">
            <PageStepHeader step={8} title="최종 배치 확정" className="mb-8" />

            <div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-normal">
                {justConfirmed ? "최종 배치가 확정되었습니다" : "최종 배치를 확정할까요?"}
              </h1>
              <p className="mt-5 text-lg font-semibold leading-8 text-[#777777]">
                {justConfirmed ? (
                  <>
                    이제 쇼핑 리스트를 확인해보세요.
                    <br />
                    언제든지 다시 편집할 수 있어요.
                  </>
                ) : (
                  <>
                    마음에 드는 결과라면 확정하고
                    <br />
                    쇼핑 리스트도 확인해보세요.
                  </>
                )}
              </p>
            </div>

            <div className="confirm-room mt-3 min-h-96" ref={roomViewerContainerRef}>
              <RoomViewer
                room={roomLayout}
                furniture={roomLayout.furniture}
                selectedFurnitureId={null}
                onSelectFurniture={() => undefined}
                onMoveFurniture={() => undefined}
                hideEntranceWalls
                alignCameraToEntrance
              />
            </div>
          </section>

          <aside className="self-start rounded-xl border border-[#e3e3e3] bg-white p-6">
            <h2 className="text-lg font-extrabold">요약 정보</h2>

            <dl className="mt-6 space-y-5 text-base">
              <SummaryItem label="방 이름" value={roomLayout.name} />
              <SummaryItem label="면적" value={roomSize} />
              <SummaryItem label="가구 / 소품" value={`${furnitureCount}개`} />
            </dl>

            <div className="mt-6 border-t border-[#eeeeee] pt-6">
              {!justConfirmed ? (
                <button
                  type="button"
                  onClick={confirmLayout}
                  disabled={isWaitingForSave || layoutWorkflowState.kind !== "idle"}
                  className="w-full rounded-lg bg-[#111111] px-5 py-4 text-base font-extrabold text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#777777]"
                >
                  {isWaitingForSave ? "저장 중..." : "확정하기"}
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 rounded-lg bg-[#eefbf1] px-5 py-4 text-sm font-bold text-[#16803a]">
                    <FiCheck className="h-5 w-5 shrink-0" />
                    이 방에 배치가 저장되었어요. 다시 열어도 이 결과가 보여요.
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowShoppingList((current) => !current)}
                    aria-expanded={showShoppingList}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#dddddd] bg-white px-5 py-4 text-base font-extrabold transition-colors hover:bg-[#f6f6f6]"
                  >
                    <FiShoppingBag className="h-5 w-5" />
                    쇼핑 리스트 {showShoppingList ? "닫기" : "보기"}
                    {showShoppingList ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="animate-fade-slide-up mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111111] px-5 py-4 text-base font-extrabold text-white transition-colors hover:bg-[#333333]"
                  >
                    <FiHome className="h-5 w-5" />
                    홈 화면으로 돌아가기
                  </button>
                </>
              )}

              {(confirmationError || currentLayoutSaveError || roomSaveState.error) && !justConfirmed && (
                <p className="mt-3 text-sm font-bold text-[#c0392b]">
                  {confirmationError || "편집 내용 저장에 실패했습니다. 확정하기를 눌러 다시 시도해 주세요."}
                </p>
              )}
              {confirmationWarning && justConfirmed && (
                <p role="status" className="mt-3 text-sm font-bold text-[#8a5a00]">
                  {confirmationWarning}
                </p>
              )}
            </div>
          </aside>

          <aside
            className={`min-w-0 self-start overflow-hidden rounded-xl border bg-white transition-opacity duration-500 ease-in-out ${
              showShoppingList ? "border-[#e3e3e3] opacity-100" : "border-transparent opacity-0"
            }`}
          >
            <div className="w-[360px] p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold">쇼핑 리스트</h2>
                <button
                  type="button"
                  onClick={() => setShowShoppingList(false)}
                  aria-label="쇼핑 리스트 닫기"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#777777] hover:bg-[#f2f2f2]"
                >
                  <FiChevronUp className="h-4 w-4" />
                </button>
              </div>

              {isNaturalScenario ? (
                <ul className="space-y-3">
                  {NATURAL_SCENARIO_SHOPPING_LIST.map((entry) => {
                    const Icon = SHOPPING_LIST_ICONS[entry.iconKey];

                    return (
                      <li key={entry.name}>
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3.5 rounded-lg border border-[#eeeeee] p-3 transition-colors hover:border-[#111111] hover:bg-[#f9f9f9]"
                        >
                          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-[#f3f0eb]">
                            <Icon className="h-6 w-6 text-[#8b633d]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm font-bold">{entry.name}</strong>
                            <span className="mt-0.5 block truncate text-xs font-medium text-[#999999]">{entry.info}</span>
                          </span>
                          <FiExternalLink className="h-4 w-4 shrink-0 text-[#999999]" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm font-semibold leading-6 text-[#777777]">
                  이 스타일의 쇼핑 리스트는 아직 준비 중이에요.
                </p>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-6 flex items-center gap-5 rounded-xl border border-[#e7e7e7] bg-white px-7 py-5">
          <FiInfo className="h-8 w-8 shrink-0 stroke-[1.7]" />
          <div>
            <strong className="block text-base font-extrabold">TIP</strong>
            <p className="mt-1 text-sm font-semibold text-[#777777]">확정 후 언제든지 다시 편집할 수 있어요.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-extrabold text-[#111111]">{label}</dt>
      <dd className="mt-3 break-keep text-lg font-semibold text-[#111111]">{value}</dd>
    </div>
  );
}
