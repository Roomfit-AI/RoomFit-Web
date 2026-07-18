import { useEffect, useMemo, useRef, useState } from "react";
import { FiMoreHorizontal, FiRotateCcw, FiTrash2, FiZoomIn } from "react-icons/fi";

import { getSampleRoomLayouts } from "../api/rooms";
import { RoomViewer } from "../components/room/RoomViewer";
import {
  moveFurnitureInsideRoom,
  rotateFurnitureInsideRoom,
} from "../components/room/furnitureBoundary";
import { resolveRoomLayoutPreferredColorTone } from "../config/appliedColorTone";
import { getLiveMirrorForSelectedRoom } from "../config/confirmedLayouts";
import { loadManagedFurnitureLayout } from "../config/layoutEditingWorkflow";
import { captureCanvasThumbnail, saveRoomThumbnail } from "../config/roomThumbnails";
import { sampleRoomLayouts } from "../mock/interiorPlacementMock";
import { sampleRoom } from "../mock/sampleRoom";
import type { Furniture, FurnitureCategory, RoomLayout, Vector2D } from "../types";

const specs: Record<FurnitureCategory, string> = {
  bed: "W2000 D1250 H450",
  desk: "W1000 D580 H350",
  chair: "W1650 D820 H720",
  cabinet: "W1200 D380 H900",
  rug: "W1650 D1200",
  lighting: "W350 D350 H1550",
  unsupported: "크기 정보 없음",
};

export default function ManageFurniture() {
  const [selectedRoom, setSelectedRoom] = useState<RoomLayout>(() => getSelectedRoom());
  const selectedRoomMeta = useMemo(() => getSelectedRoomMeta(selectedRoom), [selectedRoom]);
  const preferredColorTone = useMemo(
    () => resolveRoomLayoutPreferredColorTone(selectedRoom),
    [selectedRoom],
  );
  const [furniture, setFurniture] = useState<Furniture[]>(() => cloneFurniture(selectedRoom.furniture));
  // The as-uploaded baseline for the "초기화" button. Kept out of localStorage
  // on purpose — the persist effect below overwrites `roomfit:selectedRoomLayout`
  // with the *current* (edited) furniture on every change, so that key can't
  // also serve as "what it looked like originally" once anything's been moved.
  const originalFurnitureRef = useRef<Furniture[]>(cloneFurniture(selectedRoom.furniture));
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  // Starts true (not false) so the very first render already shows/captures
  // the interior view, without an initial exterior-view render needing to be
  // undone by an effect right after mount.
  const [hideEntranceWalls, setHideEntranceWalls] = useState(true);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [layoutError, setLayoutError] = useState("");

  const visibleFurniture = furniture.filter((item) => item.status !== "deleted");

  useEffect(() => {
    if (localStorage.getItem("roomfit:selectedRoomLayout") || localStorage.getItem("roomfit:selectedRoomId")) {
      return;
    }

    getSampleRoomLayouts()
      .then((rooms) => {
        const firstRoom = rooms[0];

        if (!firstRoom) {
          return;
        }

        setSelectedRoom(firstRoom);
        setFurniture(cloneFurniture(firstRoom.furniture));
        originalFurnitureRef.current = cloneFurniture(firstRoom.furniture);
        localStorage.setItem("roomfit:selectedRoomLayout", JSON.stringify(firstRoom));
        localStorage.setItem("roomfit:selectedRoomId", firstRoom.id);
        localStorage.setItem("roomfit:selectedRoomTitle", firstRoom.name);
        localStorage.setItem("roomfit:selectedRoomType", "원룸");
        localStorage.setItem("roomfit:selectedRoomSize", `${Math.round(firstRoom.width * firstRoom.depth)}㎡`);
      })
      .catch(() => {
        setSelectedRoom(sampleRoom);
        setFurniture(cloneFurniture(sampleRoom.furniture));
        originalFurnitureRef.current = cloneFurniture(sampleRoom.furniture);
      });
  }, []);

  useEffect(() => {
    const rawRoomId = localStorage.getItem("roomfit:backendRoomId");
    const backendRoomId = rawRoomId ? Number(rawRoomId) : Number.NaN;
    if (!Number.isInteger(backendRoomId) || backendRoomId <= 0) return;

    let cancelled = false;
    loadManagedFurnitureLayout(selectedRoom, backendRoomId)
      .then((restored) => {
        if (cancelled || !restored) return;
        setSelectedRoom(restored);
        setFurniture(cloneFurniture(restored.furniture));
        originalFurnitureRef.current = cloneFurniture(restored.furniture);
        setLayoutError("");
      })
      .catch(() => {
        if (!cancelled) {
          setLayoutError("저장된 배치를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      });

    return () => {
      cancelled = true;
    };
    // The selected room is fixed for this page mount. Including selectedRoom
    // would refetch after applying the restored backend snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const removeFurniture = (id: string) => {
    setFurniture((current) => current.map((item) => (
      item.id === id ? { ...item, status: "deleted" } : item
    )));
    setSelectedFurnitureId((current) => (current === id ? null : current));
  };

  const moveFurniture = (id: string, position: Vector2D) => {
    setFurniture((current) => current.map((item) => (
      item.id === id
        ? markUserModified(moveFurnitureInsideRoom(selectedRoom, item, position))
        : item
    )));
  };

  const resetFurniture = () => {
    setFurniture(cloneFurniture(originalFurnitureRef.current));
    setSelectedFurnitureId(null);
  };

  const rotateFurniture = (id: string) => {
    setFurniture((current) =>
      current.map((item) => (
        item.id === id
          ? markUserModified(rotateFurnitureInsideRoom(selectedRoom, item, item.rotationY + Math.PI / 2))
          : item
      )),
    );
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

  useEffect(() => {
    const nextRoom = {
      ...selectedRoom,
      furniture,
    };

    localStorage.setItem("roomfit:selectedRoomLayout", JSON.stringify(nextRoom));
  }, [selectedRoom, furniture]);

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

          {layoutError && (
            <p role="alert" className="mb-4 rounded-lg bg-[#fff1f1] px-4 py-3 text-sm font-bold text-[#b42318]">
              {layoutError}
            </p>
          )}

          <div className="manage-room flex-1" ref={viewerContainerRef}>
            <RoomViewer
              room={selectedRoom}
              furniture={visibleFurniture}
              selectedFurnitureId={selectedFurnitureId}
              onSelectFurniture={setSelectedFurnitureId}
              onMoveFurniture={moveFurniture}
              hideEntranceWalls={hideEntranceWalls}
              alignCameraToEntrance
              showEditingHelpers
              preferredColorTone={preferredColorTone}
            />
          </div>

          <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.08)]">
            <ToolButton label="선택" icon={<span className="text-lg">↖</span>} />
            <ToolButton
              label="90° 회전"
              icon={<span className="text-[11px] font-extrabold leading-none">90°</span>}
              onClick={selectedFurnitureId ? () => rotateFurniture(selectedFurnitureId) : undefined}
            />
            <ToolButton label="초기화" icon={<FiRotateCcw />} onClick={resetFurniture} />
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
                />
              ))}
            </div>

          </div>
        </aside>
      </div>
    </main>
  );
}

function FurnitureRow({
  item,
  selected,
  onSelect,
  onRemove,
}: {
  item: Furniture;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-2 transition-colors ${selected ? "border-[#111111] bg-[#fafafa]" : "border-transparent"}`}>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <FurnitureThumb category={item.category} color={item.color} />
        <span className="min-w-0">
          <strong className="block truncate text-sm font-extrabold">{item.name.replace("기존 ", "")}</strong>
          <span className="mt-1 block truncate text-xs font-medium text-[#666666]">{specs[item.category]}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${item.name} 삭제`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#888888] hover:bg-[#f1f1f1] hover:text-[#111111]"
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
  const liveMirror = getLiveMirrorForSelectedRoom();
  if (liveMirror) {
    return liveMirror;
  }

  const selectedRoomLayout = localStorage.getItem("roomfit:selectedRoomLayout");
  if (selectedRoomLayout) {
    try {
      return JSON.parse(selectedRoomLayout) as RoomLayout;
    } catch {
      localStorage.removeItem("roomfit:selectedRoomLayout");
    }
  }

  const selectedRoomId = localStorage.getItem("roomfit:selectedRoomId");
  return sampleRoomLayouts.find((room) => room.id === selectedRoomId) ?? sampleRoom;
}

function getSelectedRoomMeta(room: RoomLayout) {
  return {
    title: localStorage.getItem("roomfit:selectedRoomTitle") ?? room.name,
    type: localStorage.getItem("roomfit:selectedRoomType") ?? "원룸",
    size: localStorage.getItem("roomfit:selectedRoomSize") ?? `${Math.round(room.width * room.depth)}㎡`,
  };
}

function cloneFurniture(items: Furniture[]): Furniture[] {
  return items.map((item) => ({ ...item, position: { ...item.position }, dimensions: { ...item.dimensions } }));
}

function markUserModified(item: Furniture): Furniture {
  return item.status === "deleted" ? item : { ...item, status: "user_modified" };
}
