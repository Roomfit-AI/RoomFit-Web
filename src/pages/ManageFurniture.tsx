import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiChevronUp, FiMoreHorizontal, FiPlus, FiRotateCcw, FiTrash2, FiZoomIn } from "react-icons/fi";

import { isLayoutSessionConfirmed } from "../api/layoutConfirmation";
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
  clearActiveRoomFurnitureSaveStateIfOwned,
  enqueueActiveRoomFurnitureSave,
  flushActiveRoomFurnitureSave,
  getActiveRoomFurnitureSaveState,
  getPersistedRoomFurnitureSaveDraft,
  recoverActiveRoomFurnitureSave,
  retryActiveRoomFurnitureSave,
  setActiveRoomFurnitureSaveSession,
  useActiveRoomFurnitureSaveState,
} from "../api/roomFurnitureSaveCoordinator";
import {
  clearLayoutSession,
  hasSameLayoutOwnership,
  isLayoutOwnershipForRoom,
  readLayoutSession,
  toLayoutSession,
  writeLayoutSession,
  type LayoutSession,
} from "../api/layoutSession";
import { assertActiveLayoutEditingAllowed, beginActiveLayoutWorkflow, endActiveLayoutWorkflow } from "../api/layoutWorkflow";
import {
  commitStagedSelectedRoomEnvelope,
  readSelectedRoomEnvelope,
  stageSelectedRoomEnvelope,
} from "../api/roomSelectionStorage";
import { getSampleRooms } from "../api/rooms";
import { RoomViewer } from "../components/room/RoomViewer";
import { getLiveMirrorForSelectedRoom } from "../config/confirmedLayouts";
import { captureCanvasThumbnail, saveRoomThumbnail } from "../config/roomThumbnails";
import { sampleRoom } from "../mock/sampleRoom";
import type { Furniture, FurnitureCategory, RoomLayout, Vector2D } from "../types";

const furnitureCatalog: Furniture[] = [
  {
    id: "catalog-sofa",
    name: "소파",
    category: "chair",
    geometry: "rounded-box",
    dimensions: { width: 1.65, depth: 0.82, height: 0.72 },
    position: { x: -0.9, z: 0.85 },
    rotationY: 0,
    color: "#f2ebe2",
    material: { type: "fabric", color: "#f2ebe2", roughness: 0.92, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "catalog-table",
    name: "커피테이블",
    category: "desk",
    geometry: "cylinder",
    dimensions: { width: 0.92, depth: 0.92, height: 0.35 },
    position: { x: 0.15, z: 0.1 },
    rotationY: 0,
    color: "#a9794d",
    material: { type: "wood", color: "#a9794d", roughness: 0.55, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "catalog-tv",
    name: "TV 장식장",
    category: "cabinet",
    geometry: "rounded-box",
    dimensions: { width: 1.7, depth: 0.38, height: 0.42 },
    position: { x: -1.15, z: -1.86 },
    rotationY: 0,
    color: "#8a6542",
    material: { type: "wood", color: "#8a6542", roughness: 0.56, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "catalog-shelf",
    name: "책장",
    category: "cabinet",
    geometry: "box",
    dimensions: { width: 0.55, depth: 0.34, height: 1.55 },
    position: { x: 2.35, z: -1.35 },
    rotationY: 0,
    color: "#8b633d",
    material: { type: "wood", color: "#8b633d", roughness: 0.56, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "catalog-rug",
    name: "러그",
    category: "rug",
    geometry: "plane",
    dimensions: { width: 1.65, depth: 1.2, height: 0.04 },
    position: { x: 0.0, z: 0.18 },
    rotationY: 0,
    color: "#d8c7ad",
    material: { type: "fabric", color: "#d8c7ad", roughness: 0.96, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "catalog-light",
    name: "플로어 조명",
    category: "lighting",
    geometry: "cylinder",
    dimensions: { width: 0.35, depth: 0.35, height: 1.55 },
    position: { x: 1.95, z: -0.7 },
    rotationY: 0,
    color: "#26211d",
    material: { type: "metal", color: "#26211d", roughness: 0.25, metalness: 0.8 },
    status: "recommended",
    removable: true,
  },
];

const specs: Record<FurnitureCategory, string> = {
  bed: "W2000 D1250 H450",
  desk: "W1000 D580 H350",
  chair: "W1650 D820 H720",
  cabinet: "W1200 D380 H900",
  rug: "W1650 D1200",
  lighting: "W350 D350 H1550",
};

export default function ManageFurniture() {
  const [selectedRoom, setSelectedRoom] = useState<RoomLayout>(() => getSelectedRoom());
  const selectedRoomMeta = useMemo(() => getSelectedRoomMeta(selectedRoom), [selectedRoom]);
  const [furniture, setFurniture] = useState<Furniture[]>(() => cloneFurniture(selectedRoom.furniture));
  const furnitureRef = useRef<Furniture[]>(cloneFurniture(selectedRoom.furniture));
  // The as-uploaded baseline for the "초기화" button. The Room save
  // coordinator updates `roomfit:selectedRoomLayout` with each accepted edit,
  // so that key cannot also represent the original arrangement.
  const originalFurnitureRef = useRef<Furniture[]>(cloneFurniture(selectedRoom.furniture));
  const addedFurnitureSequenceRef = useRef(0);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  // Starts true (not false) so the very first render already shows/captures
  // the interior view, without an initial exterior-view render needing to be
  // undone by an effect right after mount.
  const [hideEntranceWalls, setHideEntranceWalls] = useState(true);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [preparedRoomEditKey, setPreparedRoomEditKey] = useState<string | null>(null);
  const [roomEditFailure, setRoomEditFailure] = useState<{ key: string; message: string } | null>(null);
  const [roomEditPreparationAttempt, setRoomEditPreparationAttempt] = useState(0);
  const roomEditPreparationRef = useRef<{ key: string; promise: Promise<LayoutSession | null> } | null>(null);
  const invalidatedLayoutSessionRef = useRef<LayoutSession | null>(null);
  const mountedRef = useRef(true);
  const roomSaveState = useActiveRoomFurnitureSaveState();
  const roomEditPreparationKey = `${selectedRoom.id}:${roomEditPreparationAttempt}`;
  const isRoomEditReady = preparedRoomEditKey === roomEditPreparationKey;
  const roomEditError = roomEditFailure?.key === roomEditPreparationKey
    ? roomEditFailure.message
    : roomSaveState.session?.ownerUiRoomLayoutId === selectedRoom.id && roomSaveState.error
      ? roomSaveState.hasPending
        ? "가구 배치를 저장하지 못했습니다. 다시 시도해 주세요."
        : "저장 준비에 실패했습니다. 준비를 다시 한 뒤 가구 편집을 다시 적용해 주세요."
      : "";

  const visibleFurniture = furniture.filter((item) => item.status !== "deleted");
  const activeCatalogIds = new Set(visibleFurniture.map(getCatalogIdFromFurniture).filter(Boolean));
  const availableFurniture = furnitureCatalog.filter((item) => !activeCatalogIds.has(item.id));

  useEffect(() => {
    if (roomEditPreparationRef.current?.key !== roomEditPreparationKey) {
      roomEditPreparationRef.current = {
        key: roomEditPreparationKey,
        promise: prepareRoomFurnitureEditing(selectedRoom.id),
      };
    }

    let subscribed = true;
    void roomEditPreparationRef.current.promise
      .then((layoutSession) => {
        invalidatedLayoutSessionRef.current = layoutSession;
        if (subscribed) {
          setRoomEditFailure(null);
          setPreparedRoomEditKey(roomEditPreparationKey);
        }
      })
      .catch((error) => {
        if (subscribed) {
          console.error("이전 배치를 저장하지 못해 가구 편집을 시작하지 않았습니다.", error);
          setRoomEditFailure({
            key: roomEditPreparationKey,
            message: "이전 배치를 저장하지 못했습니다. 다시 시도해 주세요.",
          });
        }
      });

    return () => {
      subscribed = false;
    };
  }, [roomEditPreparationKey, selectedRoom.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const currentSelection = readSelectedRoomEnvelope();
    if (currentSelection.status === "valid") {
      return;
    }
    if (currentSelection.status === "storage-error") {
      const timeoutId = window.setTimeout(() => setRoomEditFailure({
          key: roomEditPreparationKey,
          message: "브라우저 저장소를 읽지 못해 방을 준비하지 못했습니다.",
        }), 0);
      return () => window.clearTimeout(timeoutId);
    }

    getSampleRooms()
      .then((rooms) => {
        const firstRoom = rooms[0];

        if (!firstRoom) {
          return;
        }

        const nextSelection = {
          version: 1 as const,
          backendRoomId: firstRoom.roomId,
          uiRoomLayoutId: firstRoom.layoutId,
          title: firstRoom.title,
          category: firstRoom.category,
          size: firstRoom.size,
          roomLayout: firstRoom.layout,
        };
        stageSelectedRoomEnvelope(nextSelection);
        commitStagedSelectedRoomEnvelope(nextSelection);
        setSelectedRoom(firstRoom.layout);
        const nextFurniture = cloneFurniture(firstRoom.layout.furniture);
        furnitureRef.current = nextFurniture;
        setFurniture(nextFurniture);
        originalFurnitureRef.current = cloneFurniture(firstRoom.layout.furniture);
      })
      .catch((error) => {
        console.warn("기본 Room 선택을 저장하지 못했습니다.", error);
        setSelectedRoom(sampleRoom);
        const nextFurniture = cloneFurniture(sampleRoom.furniture);
        furnitureRef.current = nextFurniture;
        setFurniture(nextFurniture);
        originalFurnitureRef.current = cloneFurniture(sampleRoom.furniture);
        setRoomEditFailure({
          key: roomEditPreparationKey,
          message: "방 선택 정보를 저장하지 못해 편집을 시작하지 않았습니다.",
        });
      });
  }, [roomEditPreparationKey]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      setPanelWidth(Math.min(520, Math.max(280, nextWidth)));
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const addFurniture = (item: Furniture) => {
    if (!isRoomEditReady) return;

    addedFurnitureSequenceRef.current += 1;
    const nextItem = {
      ...item,
      id: `added-${item.id}-${addedFurnitureSequenceRef.current}`,
      position: findOpenPosition(furnitureRef.current.length),
    };

    if (commitRoomFurnitureEdit([...furnitureRef.current, nextItem])) {
      setSelectedFurnitureId(nextItem.id);
    }
  };

  const removeFurniture = (id: string) => {
    if (!isRoomEditReady) return;

    if (commitRoomFurnitureEdit(furnitureRef.current.filter((item) => item.id !== id))) {
      setSelectedFurnitureId((current) => (current === id ? null : current));
    }
  };

  const moveFurniture = (id: string, position: Vector2D) => {
    if (!isRoomEditReady) return;

    commitRoomFurnitureEdit(
      furnitureRef.current.map((item) => (item.id === id ? { ...item, position } : item)),
    );
  };

  const resetFurniture = () => {
    if (!isRoomEditReady) return;

    if (commitRoomFurnitureEdit(cloneFurniture(originalFurnitureRef.current))) {
      setSelectedFurnitureId(null);
    }
  };

  const rotateFurniture = (id: string) => {
    if (!isRoomEditReady) return;

    commitRoomFurnitureEdit(
      furnitureRef.current.map((item) => (
        item.id === id ? { ...item, rotationY: item.rotationY + Math.PI / 2 } : item
      )),
    );
  };

  const commitRoomFurnitureEdit = (nextFurniture: Furniture[]): boolean => {
    if (!isRoomEditReady) {
      return false;
    }

    try {
      assertActiveLayoutEditingAllowed();
      const selection = readSelectedRoomEnvelope();
      if (
        selection.status !== "valid"
        || selection.selection.uiRoomLayoutId !== selectedRoom.id
      ) {
        throw new Error("현재 방과 Room 저장 owner가 일치하지 않습니다.");
      }

      setActiveRoomFurnitureSaveSession({
        ownerBackendRoomId: selection.selection.backendRoomId,
        ownerUiRoomLayoutId: selectedRoom.id,
      });
      const nextRoom = {
        ...selectedRoom,
        furniture: cloneFurniture(nextFurniture),
      };
      enqueueActiveRoomFurnitureSave(nextRoom);

      furnitureRef.current = cloneFurniture(nextFurniture);
      setFurniture(furnitureRef.current);
      setRoomEditFailure(null);

      const layoutSession = invalidatedLayoutSessionRef.current;
      void flushActiveRoomFurnitureSave()
        .then(() => {
          if (layoutSession) {
            const cleanupComplete = clearInvalidatedLayoutSession(layoutSession);
            if (cleanupComplete && invalidatedLayoutSessionRef.current && hasSameLayoutOwnership(
              invalidatedLayoutSessionRef.current,
              layoutSession,
            )) {
              invalidatedLayoutSessionRef.current = null;
            }
            if (!cleanupComplete && mountedRef.current) {
              setRoomEditFailure({
                key: roomEditPreparationKey,
                message: "가구 배치는 저장됐지만 이전 배치 정리에 실패했습니다. 다시 시도해 주세요.",
              });
              return;
            }
          }
          if (mountedRef.current) {
            setRoomEditFailure(null);
          }
        })
        .catch((error) => {
          console.error("가구 배치를 백엔드에 저장하지 못했습니다.", error);
          if (mountedRef.current) {
            setRoomEditFailure({
              key: roomEditPreparationKey,
              message: "가구 배치를 저장하지 못했습니다. 다시 시도해 주세요.",
            });
          }
        });
      return true;
    } catch (error) {
      console.error("가구 편집을 저장 대상으로 등록하지 못했습니다.", error);
      setRoomEditFailure({
        key: roomEditPreparationKey,
        message: "저장 준비에 실패했습니다. 준비를 다시 한 뒤 가구 편집을 다시 적용해 주세요.",
      });
      return false;
    }
  };

  const retryRoomFurnitureSave = () => {
    const currentRoomSave = getActiveRoomFurnitureSaveState();
    if (currentRoomSave.error && !currentRoomSave.hasPending) {
      try {
        const session = currentRoomSave.session;
        if (session) {
          clearActiveRoomFurnitureSaveStateIfOwned(session);
        }
        setRoomEditFailure(null);
        setRoomEditPreparationAttempt((attempt) => attempt + 1);
      } catch (error) {
        console.error("Room 저장 준비 오류를 초기화하지 못했습니다.", error);
      }
      return;
    }

    const layoutSession = invalidatedLayoutSessionRef.current;
    setRoomEditFailure(null);
    void retryActiveRoomFurnitureSave()
      .then(() => {
        if (layoutSession) {
          if (!clearInvalidatedLayoutSession(layoutSession)) {
            throw new Error("Previous Layout cleanup failed");
          }
          invalidatedLayoutSessionRef.current = null;
        }
      })
      .catch((error) => {
        console.error("가구 배치 저장 재시도에 실패했습니다.", error);
        if (mountedRef.current) {
          setRoomEditFailure({
            key: roomEditPreparationKey,
            message: error instanceof Error && error.message === "Previous Layout cleanup failed"
              ? "가구 배치는 저장됐지만 이전 배치 정리에 실패했습니다. 다시 시도해 주세요."
              : "가구 배치를 저장하지 못했습니다. 다시 시도해 주세요.",
          });
        }
      });
  };

  // /rooms' cards otherwise only have the iOS app's scan-time snapshot to
  // show (a flat, textureless RoomPlan mesh capture — see api/rooms.ts's
  // thumbnailBase64) — this actually-furnished, colored 3D view is a much
  // better thumbnail. The short delay gives the now-hidden walls a couple of
  // render frames to actually disappear before the frame is captured,
  // instead of grabbing the outgoing walls-visible one.
  const captureInteriorThumbnail = () => {
    window.setTimeout(() => {
      const container = viewerContainerRef.current;
      const dataUrl = container && captureCanvasThumbnail(container);

      if (dataUrl) {
        saveRoomThumbnail(selectedRoom.id, dataUrl);
      }
    }, 300);
  };

  const handleToggleInteriorView = (checked: boolean) => {
    setHideEntranceWalls(checked);

    if (checked) {
      captureInteriorThumbnail();
    }
  };

  // Relying on the user remembering to manually flip "내부 보기" made this
  // easy to skip entirely — a room could go all the way to /layout-confirm
  // still showing no real thumbnail on /rooms. Capturing once, right when
  // this room is first opened here (hideEntranceWalls already starts true —
  // see its useState above), means every room gets a real thumbnail before
  // confirming even happens, not just the ones someone happened to click the
  // checkbox for.
  useEffect(() => {
    captureInteriorThumbnail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] text-[#141414]">
      <div
        className="grid min-h-[calc(100vh-76px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_10px_var(--furniture-panel-width)]"
        style={{ "--furniture-panel-width": `${panelWidth}px` } as React.CSSProperties}
      >
        <section className="relative flex min-h-140 flex-col px-6 py-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="ml-2 text-2xl font-extrabold">{selectedRoomMeta.title}</h1>
              <span className="rounded-full bg-[#eeeeee] px-3 py-1 text-xs font-bold text-[#777777]">{selectedRoomMeta.type}</span>
              <span className="rounded-full bg-[#eeeeee] px-3 py-1 text-xs font-bold text-[#777777]">{selectedRoomMeta.size}</span>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#dfdfdf] bg-white px-3 py-2 text-sm font-extrabold text-[#333333] transition-colors hover:bg-[#f6f6f6]">
              <input
                type="checkbox"
                checked={hideEntranceWalls}
                onChange={(event) => handleToggleInteriorView(event.target.checked)}
                className="h-4 w-4 accent-[#111111]"
              />
              내부 보기
            </label>
          </div>

          <div className="manage-room flex-1" ref={viewerContainerRef}>
            <RoomViewer
              room={selectedRoom}
              furniture={furniture}
              selectedFurnitureId={selectedFurnitureId}
              onSelectFurniture={setSelectedFurnitureId}
              onMoveFurniture={moveFurniture}
              hideEntranceWalls={hideEntranceWalls}
              alignCameraToEntrance
              showEditingHelpers={isRoomEditReady}
            />
          </div>

          <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.08)]">
            <ToolButton label="선택" icon={<span className="text-lg">↖</span>} />
            <ToolButton
              label="90° 회전"
              icon={<span className="text-[11px] font-extrabold leading-none">90°</span>}
              onClick={isRoomEditReady && selectedFurnitureId ? () => rotateFurniture(selectedFurnitureId) : undefined}
            />
            <ToolButton label="초기화" icon={<FiRotateCcw />} onClick={isRoomEditReady ? resetFurniture : undefined} />
            <ToolButton label="중앙 보기" icon={<span className="text-lg">⊙</span>} />
            <ToolButton label="확대" icon={<FiZoomIn />} />
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="가구 패널 크기 조절"
          onPointerDown={() => setIsResizing(true)}
          className="hidden cursor-col-resize border-l border-[#eeeeee] bg-[#fbfbfb] transition-colors hover:bg-[#eeeeee] lg:block"
        />

        <aside className="border-t border-[#eeeeee] bg-[#fbfbfb] p-5 lg:border-l-0 lg:border-t-0">
          {(!isRoomEditReady || roomEditError) && (
            <div className="mb-4 rounded-lg border border-[#e2e2e2] bg-white px-4 py-3 text-sm font-semibold text-[#555555]" role={roomEditError ? "alert" : "status"}>
              <span>{roomEditError || "이전 배치를 저장하는 중입니다."}</span>
              {roomEditError && (
                <button
                  type="button"
                  className="ml-3 font-extrabold text-[#111111] underline underline-offset-2"
                  onClick={isRoomEditReady
                    ? retryRoomFurnitureSave
                    : () => {
                        setRoomEditFailure(null);
                        setRoomEditPreparationAttempt((current) => current + 1);
                      }}
                >
                  다시 시도
                </button>
              )}
            </div>
          )}
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-extrabold">가구 현황</h2>
              <button type="button" aria-label="더보기" className="rounded-full p-2 hover:bg-[#f3f3f3]">
                <FiMoreHorizontal />
              </button>
            </div>

            <div className="max-h-[calc(100vh-320px)] space-y-4 overflow-y-auto pr-1">
              {visibleFurniture.map((item) => (
                <FurnitureRow
                  key={item.id}
                  item={item}
                  selected={selectedFurnitureId === item.id}
                  onSelect={() => setSelectedFurnitureId(item.id)}
                  onRemove={() => removeFurniture(item.id)}
                  disabled={!isRoomEditReady}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCatalogOpen((current) => !current)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#dfdfdf] py-3 text-sm font-extrabold transition-colors hover:bg-[#f6f6f6]"
            >
              <FiPlus />
              가구 추가
              {isCatalogOpen ? <FiChevronUp /> : <FiChevronDown />}
            </button>

            {isCatalogOpen && (
              <div className="mt-4 border-t border-[#eeeeee] pt-4">
                <h3 className="mb-3 text-sm font-extrabold text-[#555555]">추가 가능한 가구</h3>
                <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                  {availableFurniture.length > 0 ? (
                    availableFurniture.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addFurniture(item)}
                        disabled={!isRoomEditReady}
                        className="flex w-full items-center justify-between rounded-lg border border-[#eeeeee] px-4 py-3 text-sm font-bold transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <FurnitureThumb category={item.category} color={item.color} />
                          <span className="min-w-0 text-left">
                            <span className="block truncate">{item.name}</span>
                            <span className="mt-1 block truncate text-xs font-medium text-[#777777]">{specs[item.category]}</span>
                          </span>
                        </span>
                        <FiPlus className="shrink-0" />
                      </button>
                    ))
                  ) : (
                    <p className="rounded-lg bg-[#f7f7f7] px-4 py-3 text-sm font-semibold text-[#777777]">
                      추가할 수 있는 가구를 모두 배치했어요.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

async function prepareRoomFurnitureEditing(ownerUiRoomLayoutId: string): Promise<LayoutSession | null> {
  const storedSession = readLayoutSession();
  const memorySession = getActiveLayoutSaveState().session;
  if (storedSession && memorySession && !hasSameLayoutOwnership(storedSession, memorySession)) {
    throw new Error("Stored and active layout sessions do not match");
  }

  const selected = readSelectedRoomEnvelope();
  if (
    selected.status !== "valid"
    || selected.selection.uiRoomLayoutId !== ownerUiRoomLayoutId
  ) {
    throw new Error("Selected Room owner is missing or invalid");
  }
  const ownerBackendRoomId = selected.selection.backendRoomId;
  let session = storedSession ?? memorySession;
  const draft = getPersistedActiveLayoutDraft();

  if (!session && draft) {
    if (
      ownerBackendRoomId
      && isLayoutOwnershipForRoom(draft, ownerBackendRoomId, ownerUiRoomLayoutId)
    ) {
      session = toLayoutSession(draft);
    }
  }

  if (session && !isLayoutOwnershipForRoom(session, ownerBackendRoomId, ownerUiRoomLayoutId)) {
    throw new Error("Active layout session does not belong to the selected room");
  }

  const workflowToken = beginActiveLayoutWorkflow("room-transition", session);
  try {
    if (draft && (!session || !hasSameLayoutOwnership(draft, session))) {
      discardPersistedActiveLayoutDraft(draft);
      console.warn("현재 배치 세션과 다른 미저장 배치를 가구 편집 전에 폐기했습니다.");
    }

    if (session) {
      writeLayoutSession(session);
      if (!isLayoutSessionConfirmed(session)) {
        setActiveLayoutSession(session);
        recoverActiveLayoutSave();
        await flushActiveLayoutSave();
      }
    }

    setActiveRoomFurnitureSaveSession({ ownerBackendRoomId, ownerUiRoomLayoutId });
    recoverActiveRoomFurnitureSave();
    await flushActiveRoomFurnitureSave();
    return session;
  } finally {
    endActiveLayoutWorkflow(workflowToken);
  }
}

function clearInvalidatedLayoutSession(expectedSession: LayoutSession): boolean {
  let complete = true;
  try {
    const activeSession = getActiveLayoutSaveState().session;
    if (activeSession && hasSameLayoutOwnership(activeSession, expectedSession)) {
      if (!clearActiveLayoutSaveStateIfOwned(expectedSession)) {
        console.warn("Room 저장 후 이전 Layout draft를 제거하지 못했습니다.");
        complete = false;
      }
    } else if (!activeSession) {
      const draft = getPersistedActiveLayoutDraft();
      if (draft && hasSameLayoutOwnership(draft, expectedSession)) {
        complete = discardPersistedActiveLayoutDraft(draft) && complete;
      }
    }
  } catch (error) {
    console.warn("Room 저장 후 이전 Layout coordinator를 정리하지 못했습니다.", error);
    complete = false;
  }

  try {
    const storedSession = readLayoutSession();
    if (storedSession && hasSameLayoutOwnership(storedSession, expectedSession)) {
      clearLayoutSession();
    }
  } catch (error) {
    console.warn("Room 저장 후 이전 Layout session을 정리하지 못했습니다.", error);
    complete = false;
  }
  return complete;
}

function FurnitureRow({
  item,
  selected,
  onSelect,
  onRemove,
  disabled,
}: {
  item: Furniture;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-2 transition-colors ${selected ? "border-[#111111] bg-[#fafafa]" : "border-transparent"}`}>
      <button type="button" onClick={onSelect} disabled={disabled} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60">
        <FurnitureThumb category={item.category} color={item.color} />
        <span className="min-w-0">
          <strong className="block truncate text-sm font-extrabold">{item.name.replace("기존 ", "")}</strong>
          <span className="mt-1 block truncate text-xs font-medium text-[#666666]">{specs[item.category]}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`${item.name} 삭제`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#888888] hover:bg-[#f1f1f1] hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FiTrash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ToolButton({
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

function FurnitureThumb({ category, color }: { category: FurnitureCategory; color: string }) {
  return (
    <span className="grid h-12 w-14 shrink-0 place-items-center rounded-lg bg-[#f6f3ef]">
      <span className={`furniture-thumb furniture-thumb-${category}`} style={{ backgroundColor: color }} />
    </span>
  );
}

function getSelectedRoom(): RoomLayout {
  // The live mirror (see confirmedLayouts.ts's getLiveMirrorForSelectedRoom)
  // reflects every edit made in /editor this session, including a just-
  // confirmed final result — id-matched against roomfit:selectedRoomId, and
  // cleared by Rooms.tsx's selectRoom every time a room is freshly (re)
  // selected from /rooms. So this only ever resurrects something within the
  // *same* room session (fixing /manage-furniture appearing to "reset" after
  // confirming and coming back without reselecting the room) — it can never
  // leak a stale scenario into a fresh retest, since picking the room again
  // from /rooms always clears it first.
  //
  // Deliberately NOT the *permanent* confirmedLayouts store here — that one
  // persists forever per room id, so preferring it would carry an old
  // scenario's furniture (different ids, already restyled/rearranged) into
  // what's supposed to be a fresh run. `applyScenario`/`applyNaturalWoodRestRoom`
  // look for the room's *original* furniture ids (e.g. "bed-1") to restyle —
  // if those were already replaced by a previous scenario's own generated
  // furniture, the new scenario silently finds nothing to transform, and
  // every retry (e.g. testing rest-natural-wood, then re-testing the same
  // room as work-modern-gray) ends up looking identical to whatever was
  // confirmed first instead of actually re-applying the newly selected mood.
  try {
    const selected = readSelectedRoomEnvelope();
    const draft = getPersistedRoomFurnitureSaveDraft();
    if (
      selected.status === "valid"
      && draft
      && draft.ownerBackendRoomId === selected.selection.backendRoomId
      && draft.ownerUiRoomLayoutId === selected.selection.uiRoomLayoutId
    ) {
      return draft.snapshot;
    }

    const liveMirror = getLiveMirrorForSelectedRoom();
    if (liveMirror) {
      return liveMirror;
    }
    if (selected.status === "valid") {
      return selected.selection.roomLayout;
    }
    return sampleRoom;
  } catch (error) {
    console.warn("선택된 Room 저장 정보를 읽지 못했습니다.", error);
    return sampleRoom;
  }
}

function getSelectedRoomMeta(room: RoomLayout) {
  const selected = readSelectedRoomEnvelope();
  return {
    title: selected.status === "valid" ? selected.selection.title : room.name,
    type: selected.status === "valid" ? selected.selection.category : "원룸",
    size: selected.status === "valid" ? selected.selection.size : `${Math.round(room.width * room.depth)}㎡`,
  };
}

function cloneFurniture(items: Furniture[]): Furniture[] {
  return items.map((item) => ({ ...item, position: { ...item.position }, dimensions: { ...item.dimensions } }));
}

function findOpenPosition(index: number): Vector2D {
  const positions = [
    { x: -0.35, z: 0.45 },
    { x: 0.95, z: 0.35 },
    { x: -1.35, z: 1.15 },
    { x: 1.65, z: -0.65 },
    { x: 0.0, z: -0.35 },
    { x: 2.15, z: 0.75 },
  ];
  return positions[index % positions.length];
}

function getCatalogIdFromFurniture(item: Furniture) {
  const matchedCatalog = furnitureCatalog.find((catalogItem) => item.id.startsWith(`added-${catalogItem.id}-`));
  return matchedCatalog?.id ?? null;
}
