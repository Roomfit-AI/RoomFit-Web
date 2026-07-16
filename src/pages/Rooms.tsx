import type { MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiBox, FiCheck, FiLoader, FiPlus, FiSmartphone, FiStar, FiTrash2 } from "react-icons/fi";

import {
  deleteUploadedRoom,
  getRecentUploadedRooms,
  getSampleRooms,
  type SampleRoomCard,
  type UploadedRoomCard,
} from "../api/rooms";
import {
  clearActiveLayoutSaveStateIfOwned,
  discardPersistedActiveLayoutDraft,
  flushActiveLayoutSave,
  getActiveLayoutSaveState,
  getPersistedActiveLayoutDraft,
  recoverActiveLayoutSave,
  setActiveLayoutSession,
} from "../api/layoutSaveCoordinator";
import {
  clearLayoutConfirmAttemptForOwner,
  discardConfirmedLayoutStaleState,
  isLayoutSessionConfirmed,
} from "../api/layoutConfirmation";
import {
  clearActiveRoomFurnitureSaveStateIfOwned,
  discardPersistedRoomFurnitureSaveDraftIfOwned,
  flushActiveRoomFurnitureSave,
  getActiveRoomFurnitureSaveState,
  getPersistedRoomFurnitureSaveDraft,
  recoverActiveRoomFurnitureSave,
  setActiveRoomFurnitureSaveSession,
} from "../api/roomFurnitureSaveCoordinator";
import {
  clearLayoutSessionForOwner,
  hasSameLayoutOwnership,
  isLayoutOwnershipForRoom,
  readLayoutSession,
  readSelectedBackendRoomId,
  toLayoutSession,
  writeLayoutSession,
  type LayoutSession,
} from "../api/layoutSession";
import {
  beginActiveLayoutWorkflow,
  endActiveLayoutWorkflow,
  useActiveLayoutWorkflowState,
  type ActiveLayoutWorkflowToken,
} from "../api/layoutWorkflow";
import {
  clearSelectedRoomEnvelopeForOwner,
  commitStagedSelectedRoomEnvelope,
  readSelectedRoomEnvelope,
  restoreSelectedRoomEnvelope,
  stageSelectedRoomEnvelope,
  type SelectedRoomEnvelope,
} from "../api/roomSelectionStorage";
import { safeStorageGet, safeStorageRemove, safeStorageSet } from "../api/safeStorage";
import { RoomViewer } from "../components/room/RoomViewer";
import { hasConfirmedLayout } from "../config/confirmedLayouts";
import { applyPreferencesToStorage, getRoomPreferences } from "../config/roomPreferences";
import { captureCanvasThumbnail, getRoomThumbnail, saveRoomThumbnail } from "../config/roomThumbnails";
import type { RoomLayout } from "../types";

const filters = ["전체", "원룸", "사무실"];
const roomsVisitedKey = "roomfit:visited:rooms";

export default function Rooms() {
  const [activeFilter, setActiveFilter] = useState("전체");
  const [roomSamples, setRoomSamples] = useState<SampleRoomCard[]>([]);
  const [uploadedRooms, setUploadedRooms] = useState<UploadedRoomCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadsLoading, setIsUploadsLoading] = useState(true);
  const [uploadNotice, setUploadNotice] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null);
  const [isSwitchingRoom, setIsSwitchingRoom] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const knownUploadIds = useRef<Set<number> | null>(null);
  const deletedUploadIds = useRef(new Set<number>());
  const roomSwitchPending = useRef(false);
  const layoutWorkflowState = useActiveLayoutWorkflowState();

  const [selectedRoomId, setSelectedRoomId] = useState(() => getInitialSelectedRoomId());
  // Ticks up after every background capture completes, purely to force
  // roomNeedingCapture below to re-check which room (if any) still needs
  // one — capturing happens one room at a time (see HiddenThumbnailCapture)
  // rather than all at once, since each capture opens its own WebGL
  // context and browsers cap how many a single page can hold open at once.
  const [thumbnailCaptureTick, setThumbnailCaptureTick] = useState(0);

  useEffect(() => {
    let ignore = false;

    getSampleRooms()
      .then((samples) => {
        if (!ignore) {
          setRoomSamples(samples);
        }
      })
      .catch(() => {
        if (!ignore) {
          setRoomSamples([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    let requestInFlight = false;

    const loadUploadedRooms = async () => {
      if (requestInFlight) return;
      requestInFlight = true;

      try {
        const rooms = (await getRecentUploadedRooms()).filter(
          (room) => !deletedUploadIds.current.has(room.roomId),
        );
        if (ignore) return;

        const nextIds = new Set(rooms.map((room) => room.roomId));
        if (
          knownUploadIds.current !== null &&
          rooms.some((room) => !knownUploadIds.current?.has(room.roomId))
        ) {
          setUploadNotice(true);
        }

        knownUploadIds.current = nextIds;
        setUploadedRooms(rooms);
      } catch {
        // Keep the last successful list while the next poll retries.
      } finally {
        requestInFlight = false;
        if (!ignore) setIsUploadsLoading(false);
      }
    };

    void loadUploadedRooms();
    const pollingId = window.setInterval(loadUploadedRooms, 3000);

    return () => {
      ignore = true;
      window.clearInterval(pollingId);
    };
  }, []);

  useEffect(() => {
    if (!uploadNotice) return;

    const timeoutId = window.setTimeout(() => setUploadNotice(false), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [uploadNotice]);

  const visibleRooms = useMemo(() => {
    if (activeFilter === "전체") return roomSamples;

    return roomSamples.filter((room) => room.category === activeFilter);
  }, [activeFilter, roomSamples]);

  // The first room (sample or uploaded) with no locally-captured thumbnail
  // yet (see getRoomThumbnail) — capturing this automatically, right when
  // the room list itself loads, means a real furnished-3D thumbnail is
  // ready the moment a room shows up here instead of only after someone
  // happens to open /manage-furniture for it.
  const roomNeedingCapture = useMemo(() => {
    const candidates: Array<{ layoutId: string; layout: RoomLayout }> = [
      ...roomSamples.map((room) => ({ layoutId: room.layoutId, layout: room.layout })),
      ...uploadedRooms.map((room) => ({ layoutId: room.layoutId, layout: room.layout })),
    ];

    return candidates.find((room) => !getRoomThumbnail(room.layoutId));
    // thumbnailCaptureTick has no meaningful value itself — it's only here
    // so a completed capture (see HiddenThumbnailCapture's onDone) forces
    // this to re-run and pick up the next room still needing one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomSamples, uploadedRooms, thumbnailCaptureTick]);

  const selectRoom = async (room: SampleRoomCard) => {
    if (roomSwitchPending.current || layoutWorkflowState.kind !== "idle") {
      return;
    }

    roomSwitchPending.current = true;
    setIsSwitchingRoom(true);
    setDeleteError("");
    let workflowToken: ActiveLayoutWorkflowToken | null = null;

    try {
      const expectedSession = readConsistentActiveSession();
      workflowToken = beginActiveLayoutWorkflow("room-transition", expectedSession);
      const selectedResult = readSelectedRoomEnvelope();
      if (selectedResult.status === "storage-error") {
        throw selectedResult.error;
      }
      const previousSelection = selectedResult.status === "valid" ? selectedResult.selection : null;
      const selectedBackendRoomId = previousSelection?.backendRoomId ?? null;
      const selectedUiRoomLayoutId = previousSelection?.uiRoomLayoutId ?? null;
      const isCurrentRoom = selectedBackendRoomId === room.roomId
        && selectedUiRoomLayoutId === room.layoutId;
      const currentSession = isCurrentRoom
        ? findLayoutSessionForRoom(room.roomId, room.layoutId)
        : null;

      if (currentSession) {
        await flushRoomFurnitureSaveForTransition();
        const confirmedCleanup = discardConfirmedLayoutStaleState(currentSession, {
          clearCoordinator: () => clearConfirmedLayoutCoordinatorState(currentSession),
          clearSession: () => {
            clearLayoutSessionForOwner(room.roomId);
          },
        });
        if (confirmedCleanup.confirmed && !confirmedCleanup.complete) {
          console.warn("확정된 배치의 stale 상태를 일부 정리하지 못했습니다.", confirmedCleanup.warnings);
        }
        if (confirmedCleanup.confirmed) {
          setSelectedRoomId(room.layoutId);
          return;
        }
        if (getActiveRoomFurnitureSaveState().latestRevision > 0) {
          clearLayoutSessionAfterRoomSave(currentSession);
          setSelectedRoomId(room.layoutId);
          return;
        }
        writeLayoutSession(currentSession);
        setActiveLayoutSession(currentSession);
        recoverActiveLayoutSave();
        setSelectedRoomId(room.layoutId);
        return;
      }

      const previousLayoutSession = await flushCurrentLayoutSessionForTransition();
      await flushRoomFurnitureSaveForTransition();
      const nextSelection = toSelectedRoomEnvelope(room);
      stageSelectedRoomEnvelope(nextSelection);
      commitStagedSelectedRoomEnvelope(nextSelection);

      try {
        if (previousLayoutSession) {
          clearLayoutSessionAfterRoomSave(previousLayoutSession);
        }
        clearCurrentRoomFurnitureSaveState(previousSelection);
        setActiveRoomFurnitureSaveSession({
          ownerBackendRoomId: nextSelection.backendRoomId,
          ownerUiRoomLayoutId: nextSelection.uiRoomLayoutId,
        });
      } catch (error) {
        if (!restoreSelectedRoomEnvelope(previousSelection)) {
          throw new Error("Room transition cleanup and selection rollback both failed", { cause: error });
        }
        throw error;
      }

      // The selected Room envelope is authoritative. Preference and thumbnail
      // mirrors below are optional and must not roll this selection back.
      setSelectedRoomId(room.layoutId);

    // Deliberately always the raw as-uploaded room, never a previously
    // confirmed result — this room can be run through /preference's
    // purpose/style pick and /editor's "AI 추천 생성" again with a *different*
    // mood than whatever was confirmed last time (this app's actual demo
    // workflow: the same physical room gets retested as both rest-natural-
    // wood and work-modern-gray). Seeding a previous scenario's already-
    // restyled furniture here means the new scenario's applyScenario/
    // applyNaturalWoodRestRoom can't find the original ids ("bed-1" etc.)
    // it looks for to transform, so the "new" mood silently doesn't apply —
    // every retry just looks like whatever was confirmed first. The
    // "확정된 배치 있음" badge (see hasConfirmedLayout below) is still the
    // visible record that a confirm happened, without resuming its data here.
    // roomfit:confirmedRoomLayout (see confirmedLayouts.ts's
    // getLiveMirrorForSelectedRoom) mirrors *any* edit made in /editor this
    // session, id-matched against roomfit:selectedRoomId — since that id
    // doesn't change when re-selecting the *same* room, a stale mirror left
    // over from a previous full run-through would otherwise still match and
    // get picked up the moment /editor opens again, silently overriding the
    // fresh raw layout just set above with the old scenario's result.
      const mirrorRemoval = safeStorageRemove("local", "roomfit:confirmedRoomLayout");
      if (mirrorRemoval.status === "storage-error") {
        console.warn("이전 Room live mirror를 정리하지 못했습니다.", mirrorRemoval.error);
      }

    // /preference, /reference-image, /add-furniture each keep their pick in
    // one global localStorage key that only resets once per browser session
    // — without this, switching to a different room here left the previous
    // room's purpose/palette/style/checked-furniture still applied there,
    // needing to be cleared out by hand. Restoring this room's own saved
    // picks (or blanking them out if it's never been through this before)
    // means every fresh room actually starts fresh, while an already-
    // confirmed room reopens showing what it was actually confirmed with.
      const preferenceWarnings = applyPreferencesToStorage(getRoomPreferences(room.layoutId));
      if (preferenceWarnings.length > 0) {
        console.warn("Room은 선택했지만 일부 취향 mirror를 적용하지 못했습니다.", preferenceWarnings);
      }
    } catch (error) {
      console.error("현재 방의 배치를 저장하지 못해 방을 전환하지 않았습니다.", error);
      setDeleteError("현재 방의 배치를 저장하지 못해 다른 방으로 이동하지 않았습니다.");
    } finally {
      if (workflowToken) {
        endActiveLayoutWorkflow(workflowToken);
      }
      roomSwitchPending.current = false;
      setIsSwitchingRoom(false);
    }
  };

  const removeUploadedRoom = async (
    event: MouseEvent<HTMLButtonElement>,
    room: UploadedRoomCard,
  ) => {
    event.stopPropagation();
    if (roomSwitchPending.current || deletingRoomId !== null || layoutWorkflowState.kind !== "idle") return;
    if (!window.confirm("이 업로드 방을 삭제할까요?")) return;

    roomSwitchPending.current = true;
    setIsSwitchingRoom(true);
    setDeletingRoomId(room.roomId);
    setDeleteError("");

    let backendDeleted = false;
    let workflowToken: ActiveLayoutWorkflowToken | null = null;
    try {
      workflowToken = beginActiveLayoutWorkflow("room-delete", readConsistentActiveSession());
      const ownedSession = findLayoutSessionForRoom(room.roomId, room.layoutId);
      if (ownedSession && !isLayoutSessionConfirmed(ownedSession)) {
        const activeSession = getActiveLayoutSaveState().session;
        if (!activeSession || hasSameLayoutOwnership(activeSession, ownedSession)) {
          setActiveLayoutSession(ownedSession);
          recoverActiveLayoutSave();
          await flushActiveLayoutSave();
        }
      }
      await flushRoomFurnitureSaveForOwner(room.roomId, room.layoutId, true);

      await deleteUploadedRoom(room.roomId);
      backendDeleted = true;
      clearDeletedRoomFurnitureSaveState({
        ownerBackendRoomId: room.roomId,
        ownerUiRoomLayoutId: room.layoutId,
      });
      if (!clearLayoutConfirmAttemptForOwner(room.roomId)) {
        console.warn("삭제된 방의 확정 기록을 제거하지 못했습니다.");
      }

      deletedUploadIds.current.add(room.roomId);
      knownUploadIds.current?.delete(room.roomId);
      setUploadedRooms((current) => current.filter((item) => item.roomId !== room.roomId));

      if (ownedSession) {
        if (!clearConfirmedLayoutCoordinatorState(ownedSession)) {
          setDeleteError("방은 삭제되었지만 로컬 미저장 배치 정리에 실패했습니다.");
        }
        try {
          clearLayoutSessionForOwner(room.roomId);
        } catch (error) {
          console.warn("삭제된 방의 배치 세션을 정리하지 못했습니다.", error);
        }
      }

      const selected = readSelectedRoomEnvelope();
      if (
        selectedRoomId === room.layoutId
        || (selected.status === "valid" && selected.selection.backendRoomId === room.roomId)
      ) {
        try {
          if (!clearSelectedRoomEnvelopeForOwner(room.roomId)) {
            throw new Error("Selected Room storage cleanup failed");
          }
          safeStorageRemove("local", "roomfit:confirmedRoomLayout");
          clearLayoutSessionForOwner(room.roomId);
        } catch (error) {
          console.warn("삭제된 방의 선택 정보를 정리하지 못했습니다.", error);
        }
        setSelectedRoomId("");
      }
    } catch (error) {
      if (backendDeleted) {
        console.warn("삭제된 방의 로컬 정보를 완전히 정리하지 못했습니다.", error);
        setDeleteError("방은 삭제되었지만 일부 로컬 정보를 정리하지 못했습니다.");
      } else {
        setDeleteError(error instanceof Error ? error.message : "업로드 방을 삭제하지 못했습니다.");
      }
    } finally {
      if (workflowToken) {
        endActiveLayoutWorkflow(workflowToken);
      }
      setDeletingRoomId(null);
      setIsSwitchingRoom(false);
      roomSwitchPending.current = false;
    }
  };

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] text-[#141414]">
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[360px_1fr] lg:px-12 lg:py-16">
        <aside className="flex flex-col">
          <div className="mb-7 flex items-center gap-4">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-[#eeeeee] text-base font-bold">
              1
            </span>
            <span className="text-lg font-semibold">
              시작 / 공간 선택
            </span>
          </div>

          <h1 className="text-[38px] font-extrabold leading-tight tracking-normal sm:text-[44px]">
            시작할 공간을
            <br />
            선택해 주세요
          </h1>

          <p className="mt-7 text-base font-medium leading-[1.7] text-[#666666]">
            앱에서 업로드한 방이나
            <br />
            원룸 샘플을 선택할 수 있어요.
          </p>

          <div className="mt-20 space-y-9">
            <InfoRow
              icon={<FiBox className="h-6 w-6" />}
              title="업로드·샘플 방 목록"
              description="선택한 공간에서 기존 편집 단계를 이어갑니다."
            />

            <InfoRow
              icon={<FiStar className="h-6 w-6" />}
              title="내 취향에 맞게 커스터마이즈"
              description="선택한 방을 내 생활 방식에 맞게 바꿀 수 있어요."
            />
          </div>
        </aside>

        <section className="space-y-12">
          <section aria-labelledby="uploaded-rooms-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="uploaded-rooms-title" className="text-xl font-extrabold">
                  앱에서 업로드된 방
                </h2>
                <p className="mt-1 text-sm text-[#777777]">
                  {uploadedRooms.length > 0 ? `${uploadedRooms.length}개의 최근 공간` : "최근 업로드"}
                </p>
              </div>

              <FiSmartphone className="h-6 w-6 text-[#555555]" aria-hidden="true" />
            </div>

            {uploadNotice && (
              <div
                role="status"
                aria-live="polite"
                className="mb-5 border-l-4 border-[#111111] bg-[#f1f1f1] px-4 py-3 text-sm font-semibold text-[#222222]"
              >
                앱에서 업로드한 방이 추가되었습니다.
              </div>
            )}

            {deleteError && (
              <div
                role="alert"
                className="mb-5 border-l-4 border-[#b42318] bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#8a1c14]"
              >
                {deleteError}
              </div>
            )}

            {isUploadsLoading ? (
              <div className="flex min-h-28 items-center justify-center border-y border-[#ececec]">
                <span className="text-sm font-semibold text-[#777777]">업로드 방을 확인하는 중...</span>
              </div>
            ) : uploadedRooms.length === 0 ? (
              <div className="flex min-h-28 items-center justify-center border-y border-[#ececec] bg-white/50 px-5 text-center">
                <span className="text-sm font-medium text-[#777777]">아직 앱에서 업로드된 방이 없습니다.</span>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {uploadedRooms.map((room) => (
                  <article
                    key={room.roomId}
                    className={`group relative overflow-hidden rounded-lg border bg-white text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(0,0,0,0.08)] ${
                      selectedRoomId === room.layoutId
                        ? "border-[#111111] shadow-[0_18px_35px_rgba(0,0,0,0.08)]"
                        : "border-[#e5e5e5] hover:border-[#cfcfcf]"
                    } ${deletingRoomId === room.roomId ? "opacity-65" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => void selectRoom(room)}
                      aria-pressed={selectedRoomId === room.layoutId}
                      disabled={deletingRoomId === room.roomId || isSwitchingRoom || layoutWorkflowState.kind !== "idle"}
                      className="block w-full p-5 text-left disabled:cursor-wait"
                    >
                      <div className="mb-4 flex min-h-6 items-center justify-between gap-3 pr-10">
                        {/* {room.source === "ROOMPLAN" ? (
                          <span className="inline-flex bg-[#151515] px-2.5 py-1 text-xs font-bold text-white">
                            ROOMPLAN
                          </span>
                        ) : (
                          <span />
                        )} */}
                        <span className="text-xs font-medium text-[#777777]">{formatUploadedAt(room.createdAt)}</span>
                      </div>

                      <RoomPreview tone={room.tone} thumbnailUrl={getRoomThumbnail(room.layoutId) ?? room.thumbnailUrl} alt={room.title} />

                      <strong className="mt-5 block text-base font-bold text-[#151515]">{room.title}</strong>
                      <span className="mt-1 block text-sm font-medium text-[#777777]">{room.dimensions}</span>

                      {hasConfirmedLayout(room.layoutId) && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#eefbf1] px-2.5 py-1 text-xs font-bold text-[#16803a]">
                          <FiCheck className="h-3.5 w-3.5" />
                          확정된 배치 있음
                        </span>
                      )}

                      {selectedRoomId === room.layoutId && (
                        <span className="absolute right-4 top-5 z-10 inline-flex items-center gap-1 rounded-full bg-[#111111] px-3 py-1.5 text-xs font-bold text-white">
                          <FiCheck className="h-3.5 w-3.5" />
                          선택됨
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      title="업로드 방 삭제"
                      aria-label={`${room.title} 삭제`}
                      disabled={deletingRoomId !== null || isSwitchingRoom || layoutWorkflowState.kind !== "idle"}
                      onClick={(event) => void removeUploadedRoom(event, room)}
                      className="absolute right-5 bottom-7 z-20 grid h-9 w-9 place-items-center rounded-md bg-white text-[#555555] transition-colors hover:border-[#b42318] hover:text-[#b42318] disabled:cursor-wait disabled:opacity-50"
                    >
                      {deletingRoomId === room.roomId ? (
                        <FiLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <FiTrash2 className="h-4 w-4" />
                      )}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="sample-rooms-title">
            <h2 id="sample-rooms-title" className="mb-5 text-xl font-extrabold">
              샘플 방
            </h2>

            <div className="mb-9 flex flex-wrap items-center gap-4">
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`min-w-24 rounded-full border px-7 py-3 text-sm font-bold transition-colors ${
                    filter === activeFilter
                      ? "border-[#111111] bg-[#111111] text-white shadow-[0_10px_22px_rgba(0,0,0,0.13)]"
                      : "border-[#e2e2e2] bg-white text-[#222222] hover:bg-[#f5f5f5]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex h-80 items-center justify-center">
                <span className="text-sm font-semibold text-[#777777]">
                  불러오는 중...
                </span>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleRooms.map((room) => (
                  <button
                    key={`${room.layoutId}-${room.title}`}
                    type="button"
                    onClick={() => void selectRoom(room)}
                    aria-pressed={selectedRoomId === room.layoutId}
                    disabled={isSwitchingRoom || deletingRoomId !== null || layoutWorkflowState.kind !== "idle"}
                    className={`group relative overflow-hidden rounded-lg border bg-white p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(0,0,0,0.08)] ${
                      selectedRoomId === room.layoutId
                        ? "border-[#111111] shadow-[0_18px_35px_rgba(0,0,0,0.08)]"
                        : "border-[#e5e5e5] hover:border-[#cfcfcf]"
                    }`}
                  >
                    {selectedRoomId === room.layoutId && (
                      <span className="absolute right-4 top-5 z-10 inline-flex items-center gap-1 rounded-full bg-[#111111] px-3 py-1.5 text-xs font-bold text-white">
                        <FiCheck className="h-3.5 w-3.5" />
                        선택됨
                      </span>
                    )}

                    <RoomPreview tone={room.tone} thumbnailUrl={getRoomThumbnail(room.layoutId) ?? room.thumbnailUrl} alt={room.title} />

                    <strong className="mt-5 block text-base font-bold text-[#151515]">
                      {room.title}
                    </strong>

                    <span className="mt-1 block text-sm font-medium text-[#777777]">
                      {room.category} · {room.size}
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  className="flex min-h-63.5 flex-col items-center justify-center rounded-lg border border-dashed border-[#d9d9d9] bg-white p-5 text-center transition-colors hover:bg-[#f6f6f6]"
                >
                
                  <span className="grid h-16 w-16 place-items-center rounded-full border border-[#d7d7d7]">
                    <FiPlus className="h-8 w-8" />
                  </span>

                  <strong className="mt-8 block text-base font-bold">
                    직접 만들기
                  </strong>

                  <span className="mt-2 text-sm text-[#777777]">
                    새 공간 만들기
                  </span>
                </button>
              </div>
            )}
          </section>
        </section>
      </section>

      {roomNeedingCapture && (
        <HiddenThumbnailCapture
          key={roomNeedingCapture.layoutId}
          room={roomNeedingCapture.layout}
          onDone={() => setThumbnailCaptureTick((tick) => tick + 1)}
        />
      )}
    </main>
  );
}

function formatUploadedAt(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "최근 업로드";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitialSelectedRoomId() {
  const visited = safeStorageGet("session", roomsVisitedKey);
  if (visited.status === "missing") {
    const write = safeStorageSet("session", roomsVisitedKey, "true");
    if (write.status === "storage-error") {
      console.warn("Room 방문 상태를 저장하지 못했습니다.", write.error);
    }
  }
  const selected = readSelectedRoomEnvelope();
  return selected.status === "valid" ? selected.selection.uiRoomLayoutId : "";
}

function readConsistentActiveSession(): LayoutSession | null {
  const storedSession = readLayoutSession();
  const memorySession = getActiveLayoutSaveState().session;
  if (storedSession && memorySession && !hasSameLayoutOwnership(storedSession, memorySession)) {
    throw new Error("Stored and active layout sessions do not match");
  }
  return storedSession ?? memorySession;
}

async function flushCurrentLayoutSessionForTransition(): Promise<LayoutSession | null> {
  const storedSession = readLayoutSession();
  const memorySession = getActiveLayoutSaveState().session;
  const draft = getPersistedActiveLayoutDraft();
  const selectedBackendRoomId = readSelectedBackendRoomId();
  const selected = readSelectedRoomEnvelope();
  const selectedUiRoomLayoutId = selected.status === "valid" ? selected.selection.uiRoomLayoutId : null;

  if (storedSession && memorySession && !hasSameLayoutOwnership(storedSession, memorySession)) {
    throw new Error("Stored and active layout sessions do not match");
  }
  let session = storedSession ?? memorySession;

  if (!session && draft) {
    if (
      selectedBackendRoomId
      && selectedUiRoomLayoutId
      && isLayoutOwnershipForRoom(draft, selectedBackendRoomId, selectedUiRoomLayoutId)
    ) {
      session = toLayoutSession(draft);
      writeLayoutSession(session);
    } else {
      discardPersistedActiveLayoutDraft(draft);
      console.warn("선택된 방과 다른 미저장 배치를 폐기했습니다.");
    }
  }

  if (!session) {
    return null;
  }
  if (
    !selectedBackendRoomId
    || !selectedUiRoomLayoutId
    || !isLayoutOwnershipForRoom(session, selectedBackendRoomId, selectedUiRoomLayoutId)
  ) {
    throw new Error("Active layout session does not belong to the selected room");
  }

  if (isLayoutSessionConfirmed(session)) {
    return session;
  }

  setActiveLayoutSession(session);
  recoverActiveLayoutSave();
  await flushActiveLayoutSave();
  return session;
}

function clearLayoutSessionAfterRoomSave(session: LayoutSession): void {
  const confirmedCleanup = discardConfirmedLayoutStaleState(session, {
    clearCoordinator: () => clearConfirmedLayoutCoordinatorState(session),
    clearSession: () => {
      clearLayoutSessionForOwner(session.ownerBackendRoomId);
    },
  });
  if (confirmedCleanup.confirmed) {
    if (!confirmedCleanup.complete) {
      throw new Error("Confirmed Layout cleanup failed after Room save");
    }
    return;
  }

  if (!clearConfirmedLayoutCoordinatorState(session)) {
    throw new Error("Layout draft cleanup failed after Room save");
  }
  clearLayoutSessionForOwner(session.ownerBackendRoomId);
}

function clearConfirmedLayoutCoordinatorState(session: LayoutSession): boolean {
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

async function flushRoomFurnitureSaveForTransition(): Promise<void> {
  const selected = readSelectedRoomEnvelope();
  if (selected.status === "storage-error") {
    throw selected.error;
  }
  if (selected.status !== "valid") {
    return;
  }
  await flushRoomFurnitureSaveForOwner(
    selected.selection.backendRoomId,
    selected.selection.uiRoomLayoutId,
  );
}

function clearCurrentRoomFurnitureSaveState(previous: SelectedRoomEnvelope | null): void {
  if (previous) {
    const cleared = clearActiveRoomFurnitureSaveStateIfOwned({
      ownerBackendRoomId: previous.backendRoomId,
      ownerUiRoomLayoutId: previous.uiRoomLayoutId,
    });
    if (!cleared) {
      throw new Error("Previous Room save owner could not be cleared");
    }
  }
}

async function flushRoomFurnitureSaveForOwner(
  ownerBackendRoomId: number,
  ownerUiRoomLayoutId: string,
  allowForeignActive = false,
): Promise<void> {
  const active = getActiveRoomFurnitureSaveState().session;
  if (
    active
    && (active.ownerBackendRoomId !== ownerBackendRoomId
      || active.ownerUiRoomLayoutId !== ownerUiRoomLayoutId)
  ) {
    if (allowForeignActive) {
      return;
    }
    throw new Error("Active Room save belongs to a different Room");
  }
  const persisted = getPersistedRoomFurnitureSaveDraft();
  if (!active && persisted) {
    if (
      persisted.ownerBackendRoomId !== ownerBackendRoomId
      || persisted.ownerUiRoomLayoutId !== ownerUiRoomLayoutId
    ) {
      return;
    }
    setActiveRoomFurnitureSaveSession({ ownerBackendRoomId, ownerUiRoomLayoutId });
    recoverActiveRoomFurnitureSave();
  }
  const current = getActiveRoomFurnitureSaveState().session;
  if (
    current
    && (current.ownerBackendRoomId !== ownerBackendRoomId
      || current.ownerUiRoomLayoutId !== ownerUiRoomLayoutId)
  ) {
    throw new Error("Active Room save belongs to a different Room");
  }
  await flushActiveRoomFurnitureSave();
}

function clearDeletedRoomFurnitureSaveState(
  deletedOwner: { ownerBackendRoomId: number; ownerUiRoomLayoutId: string },
): void {
  const active = getActiveRoomFurnitureSaveState().session;
  if (
    active
    && active.ownerBackendRoomId === deletedOwner.ownerBackendRoomId
    && active.ownerUiRoomLayoutId === deletedOwner.ownerUiRoomLayoutId
  ) {
    if (!clearActiveRoomFurnitureSaveStateIfOwned(deletedOwner)) {
      throw new Error("Deleted Room save state could not be cleared");
    }
    return;
  }
  if (!discardPersistedRoomFurnitureSaveDraftIfOwned(deletedOwner)) {
    throw new Error("Deleted Room draft could not be cleared");
  }
}

function toSelectedRoomEnvelope(room: SampleRoomCard): SelectedRoomEnvelope {
  return {
    version: 1,
    backendRoomId: room.roomId,
    uiRoomLayoutId: room.layoutId,
    title: room.title,
    category: room.category,
    size: room.size,
    roomLayout: room.layout,
  };
}

function findLayoutSessionForRoom(
  ownerBackendRoomId: number,
  ownerUiRoomLayoutId: string,
): LayoutSession | null {
  const storedSession = readLayoutSession();
  const memorySession = getActiveLayoutSaveState().session;
  const storedMatches = storedSession
    && isLayoutOwnershipForRoom(storedSession, ownerBackendRoomId, ownerUiRoomLayoutId);
  const memoryMatches = memorySession
    && isLayoutOwnershipForRoom(memorySession, ownerBackendRoomId, ownerUiRoomLayoutId);
  if (storedMatches && memoryMatches && !hasSameLayoutOwnership(storedSession, memorySession)) {
    throw new Error("Stored and active layout sessions do not match");
  }
  if (storedMatches) {
    return storedSession;
  }
  if (memoryMatches) {
    return memorySession;
  }

  const draft = getPersistedActiveLayoutDraft();
  if (draft && isLayoutOwnershipForRoom(draft, ownerBackendRoomId, ownerUiRoomLayoutId)) {
    return toLayoutSession(draft);
  }

  return null;
}

function InfoRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-5">
      <span className="mt-1 text-[#111111]">{icon}</span>

      <span>
        <strong className="block text-base font-bold">{title}</strong>

        <span className="mt-2 block text-sm leading-[1.6] text-[#777777]">
          {description}
        </span>
      </span>
    </div>
  );
}

function RoomPreview({ tone, thumbnailUrl, alt }: { tone: string; thumbnailUrl?: string; alt: string }) {
  // A real snapshot (see api/rooms.ts's thumbnailUrl, sourced from the iOS
  // app's scan-completion capture) takes priority over the generic
  // tone-based illustration below — that illustration is a decorative
  // placeholder, not a rendering of the room's actual furniture, so it only
  // applies when no real photo exists (older uploads, or sample rooms).
  if (thumbnailUrl) {
    return (
      <div className="room-preview">
        <img src={thumbnailUrl} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`room-preview room-preview-${tone}`}>
      <span className="room-wall room-wall-left" />
      <span className="room-wall room-wall-right" />
      <span className="room-floor" />
      <span className="room-window" />
      <span className="room-bed" />
      <span className="room-table" />
      <span className="room-rug" />
      <span className="room-plant" />
    </div>
  );
}

// Renders one room invisibly just long enough to grab a real 3D thumbnail
// of it, then reports back so the caller can move on to the next room still
// missing one.
function HiddenThumbnailCapture({ room, onDone }: { room: RoomLayout; onDone: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const container = containerRef.current;
      const dataUrl = container && captureCanvasThumbnail(container);

      if (dataUrl) {
        saveRoomThumbnail(room.id, dataUrl);
      }

      onDone();
    }, 500);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      // The actual bug behind the broken framing: RoomViewer's internal
      // ".viewer-shell" div (see RoomViewer.tsx / index.css) only gets a
      // real width/height from a CSS rule scoped to an ancestor className
      // — ".manage-room .viewer-shell", ".confirm-room .viewer-shell", etc.
      // Without one of those classes on this wrapper, .viewer-shell had no
      // size at all, so the Canvas/orthographic camera ended up with a
      // degenerate aspect ratio and rendered that near-empty top-down
      // sliver instead of a normal isometric view — regardless of how this
      // div itself was hidden (off-screen vs. opacity, neither mattered).
      // Reusing "manage-room" here gives it the exact same sizing as
      // /manage-furniture's real, visible viewer. Hidden via opacity +
      // negative z-index while still sitting within viewport bounds.
      className="manage-room"
      style={{ position: "fixed", inset: 0, width: 900, height: 620, opacity: 0, zIndex: -1, pointerEvents: "none" }}
    >
      <RoomViewer
        room={room}
        furniture={room.furniture}
        selectedFurnitureId={null}
        onSelectFurniture={() => undefined}
        onMoveFurniture={() => undefined}
        hideEntranceWalls
        alignCameraToEntrance
      />
    </div>
  );
}
