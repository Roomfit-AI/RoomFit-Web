import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronUp, FiMoreHorizontal, FiPlus, FiRotateCcw, FiTrash2, FiZoomIn } from "react-icons/fi";

import { getSampleRoomLayouts } from "../api/rooms";
import { RoomViewer } from "../components/room/RoomViewer";
import { sampleRoomLayouts } from "../mock/interiorPlacementMock";
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
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const activeCatalogIds = new Set(furniture.map(getCatalogIdFromFurniture).filter(Boolean));
  const availableFurniture = furnitureCatalog.filter((item) => !activeCatalogIds.has(item.id));

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
        localStorage.setItem("roomfit:selectedRoomLayout", JSON.stringify(firstRoom));
        localStorage.setItem("roomfit:selectedRoomId", firstRoom.id);
        localStorage.setItem("roomfit:selectedRoomTitle", firstRoom.name);
        localStorage.setItem("roomfit:selectedRoomType", "원룸");
        localStorage.setItem("roomfit:selectedRoomSize", `${Math.round(firstRoom.width * firstRoom.depth)}㎡`);
      })
      .catch(() => {
        setSelectedRoom(sampleRoom);
        setFurniture(cloneFurniture(sampleRoom.furniture));
      });
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

  const addFurniture = (item: Furniture) => {
    const nextItem = {
      ...item,
      id: `added-${item.id}-${Date.now()}`,
      position: findOpenPosition(furniture.length),
    };

    setFurniture((current) => [...current, nextItem]);
    setSelectedFurnitureId(nextItem.id);
  };

  const removeFurniture = (id: string) => {
    setFurniture((current) => current.filter((item) => item.id !== id));
    setSelectedFurnitureId((current) => (current === id ? null : current));
  };

  const moveFurniture = (id: string, position: Vector2D) => {
    setFurniture((current) => current.map((item) => (item.id === id ? { ...item, position } : item)));
  };

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] text-[#141414]">
      <div
        className="grid min-h-[calc(100vh-76px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_10px_var(--furniture-panel-width)]"
        style={{ "--furniture-panel-width": `${panelWidth}px` } as React.CSSProperties}
      >
        <section className="relative flex min-h-140 flex-col px-6 py-6 lg:px-8">
          <div className="mb-4 flex items-center gap-3">
            <h1 className="text-2xl font-extrabold">{selectedRoomMeta.title}</h1>
            <span className="rounded-full bg-[#eeeeee] px-3 py-1 text-xs font-bold text-[#777777]">{selectedRoomMeta.type}</span>
            <span className="rounded-full bg-[#eeeeee] px-3 py-1 text-xs font-bold text-[#777777]">{selectedRoomMeta.size}</span>
          </div>

          <div className="manage-room flex-1">
            <RoomViewer
              room={selectedRoom}
              furniture={furniture}
              selectedFurnitureId={selectedFurnitureId}
              onSelectFurniture={setSelectedFurnitureId}
              onMoveFurniture={moveFurniture}
            />
          </div>

          <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.08)]">
            <ToolButton label="선택" icon={<span className="text-lg">↖</span>} />
            <ToolButton label="초기화" icon={<FiRotateCcw />} />
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
              {furniture.map((item) => (
                <FurnitureRow
                  key={item.id}
                  item={item}
                  selected={selectedFurnitureId === item.id}
                  onSelect={() => setSelectedFurnitureId(item.id)}
                  onRemove={() => removeFurniture(item.id)}
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
                        className="flex w-full items-center justify-between rounded-lg border border-[#eeeeee] px-4 py-3 text-sm font-bold transition-colors hover:bg-[#f7f7f7]"
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

function ToolButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-full text-[#222222] hover:bg-[#f2f2f2]"
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
