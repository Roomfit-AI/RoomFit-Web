import { useEffect, useState } from "react";
import { FiCheck, FiPlus } from "react-icons/fi";

import FurnitureVisual from "../components/ui/FurnitureVisual";
import RecommendationResultPanel from "../components/editor/RecommendationResultPanel";
import {
  readRecommendationResult,
  subscribeRecommendationResult,
  type RecommendationResultNotice,
} from "../config/recommendationResult";
import { hasRoomPreferences } from "../config/roomPreferences";
import { readRoomSetupSession } from "../config/roomSetupSession";
import {
  FURNITURE_SELECTION_CATEGORIES,
  FURNITURE_SELECTION_ITEMS,
} from "../config/furnitureSelectionCatalog";
import {
  getFurnitureSelectionBlockReason,
  parseStoredRoomLayout,
} from "../config/furnitureSelectionPolicy";
const addFurnitureVisitedKey = "roomfit:visited:add-furniture";

export default function AddFurniture() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [room] = useState(() => parseStoredRoomLayout(localStorage.getItem("roomfit:selectedRoomLayout")));
  const [recommendationNotice, setRecommendationNotice] = useState<RecommendationResultNotice | null>(
    readCurrentRecommendationNotice,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const selectedRoomId = localStorage.getItem("roomfit:selectedRoomId");
    const hasRestoredPreferences = selectedRoomId ? hasRoomPreferences(selectedRoomId) : false;
    if (!sessionStorage.getItem(addFurnitureVisitedKey) && !hasRestoredPreferences) {
      localStorage.removeItem("roomfit:selectedAdditionalFurnitureIds");
    }
    sessionStorage.setItem(addFurnitureVisitedKey, "true");

    const raw = localStorage.getItem("roomfit:selectedAdditionalFurnitureIds");

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const visibleItems =
    activeCategory === "전체"
      ? FURNITURE_SELECTION_ITEMS
      : FURNITURE_SELECTION_ITEMS.filter((item) => item.category === activeCategory);

  useEffect(() => {
    localStorage.setItem("roomfit:selectedAdditionalFurnitureIds", JSON.stringify(selectedIds));
  }, [selectedIds]);

  useEffect(() => subscribeRecommendationResult(() => {
    setRecommendationNotice(readCurrentRecommendationNotice());
  }), []);

  const toggleFurniture = (id: string) => {
    const isSelected = selectedIds.includes(id);
    const reason = !isSelected ? getFurnitureSelectionBlockReason(id, selectedIds, room) : null;
    if (reason) {
      setSelectionNotice(reason);
      return;
    }
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id],
    );
  };

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] px-5 py-8 text-[#141414] sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-12 flex items-center gap-4">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#eeeeee] text-base font-bold">4</span>
          <span className="text-lg font-extrabold">가구 · 소품 선택</span>
        </div>

        <header className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">배치하고 싶은 가구와 소품을 선택하세요</h1>
          <p className="mt-3 text-sm font-semibold text-[#777777]">원하는 아이템을 선택하면 추천에 반영됩니다.</p>
        </header>

        {recommendationNotice && (
          <div className="mb-8">
            <RecommendationResultPanel notice={recommendationNotice} />
          </div>
        )}
        {selectionNotice && (
          <div role="alert" className="mb-8 rounded-xl border border-[#d7b7b1] bg-[#fff8f6] px-5 py-4 text-sm font-semibold text-[#6f3329]">
            <strong className="block">함께 배치할 수 없는 가구예요</strong>
            <span>{selectionNotice}</span>
            <button type="button" className="ml-3 underline" onClick={() => setSelectionNotice(null)}>가구 다시 선택하기</button>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[128px_1fr]">
          <aside>
            <nav className="flex gap-2 overflow-x-auto rounded-xl bg-[#f2f2f2] p-2 lg:flex-col lg:overflow-visible">
              {FURNITURE_SELECTION_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-lg px-4 py-3 text-left text-sm font-extrabold transition-colors whitespace-nowrap ${
                    activeCategory === category ? "bg-white text-[#111111] shadow-sm" : "text-[#555555] hover:bg-white/70"
                  }`}
                >
                  {category}
                </button>
              ))}
            </nav>
          </aside>

          <section>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {visibleItems.map((item) => {
                const selected = selectedIds.includes(item.id);
                const blockReason = !selected ? getFurnitureSelectionBlockReason(item.id, selectedIds, room) : null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleFurniture(item.id)}
                    disabled={Boolean(blockReason)}
                    title={blockReason ?? undefined}
                    className={`relative rounded-lg border bg-white p-3 text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(0,0,0,0.08)] ${
                      selected ? "border-[#111111]" : "border-transparent"
                    } ${blockReason ? "cursor-not-allowed opacity-45 hover:translate-y-0 hover:shadow-none" : ""
                    }`}
                  >
                    <span
                      className={`absolute right-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full border ${
                        selected ? "border-[#111111] bg-[#111111] text-white" : "border-[#d8d8d8] bg-white text-transparent"
                      }`}
                    >
                      <FiCheck className="h-4 w-4" />
                    </span>
                    <FurnitureVisual type={item.visual} />
                    <strong className="mt-4 block text-sm font-extrabold">{item.name}</strong>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="mt-12 flex w-full items-center justify-center gap-4 rounded-xl border border-[#e4e4e4] bg-white px-6 py-5 text-left transition-colors hover:bg-[#f6f6f6]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full border border-[#d8d8d8]">
                <FiPlus className="h-5 w-5" />
              </span>
              <span>
                <strong className="block text-base font-extrabold">직접 추가하기</strong>
                <span className="mt-1 block text-sm font-medium text-[#777777]">보유 중인 가구나 소품을 추가할 수 있어요.</span>
              </span>
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}

function readCurrentRecommendationNotice(): RecommendationResultNotice | null {
  const setup = readRoomSetupSession();
  if (!setup?.roomLayoutId || setup.backendRoomId === null) return null;
  return readRecommendationResult({
    sessionId: setup.sessionId,
    roomLayoutId: setup.roomLayoutId,
    backendRoomId: setup.backendRoomId,
  });
}
