import { useEffect, useState } from "react";
import { FiCheck, FiPlus } from "react-icons/fi";

import FurnitureVisual from "../components/ui/FurnitureVisual";
import type { FurnitureVisualType } from "../components/ui/FurnitureVisuals";

const categories = [
  "전체",
  "침대",
  "소파",
  "테이블",
  "책상",
  "의자",
  "선반",
  "수납",
  "전자기기",
  "조명",
  "데코",
] as const;
type FurnitureCategory = (typeof categories)[number];

type FurnitureItem = {
  id: string;
  category: Exclude<FurnitureCategory, "전체">;
  name: string;
  visual: FurnitureVisualType;
};
const addFurnitureVisitedKey = "roomfit:visited:add-furniture";

const furnitureItems: FurnitureItem[] = [
  // 침대
  { id: "bed", category: "침대", name: "침대", visual: "bed" },
  { id: "sofa-bed", category: "침대", name: "소파베드", visual: "sofaBed" },

  // 소파
  { id: "sofa", category: "소파", name: "소파", visual: "sofa" },

  // 테이블
  { id: "nightstand", category: "테이블", name: "협탁", visual: "nightstand" },
  { id: "side-table", category: "테이블", name: "사이드 테이블", visual: "sideTable" },
  { id: "multi-table", category: "테이블", name: "다용도 테이블", visual: "table" },

  // 책상
  { id: "desk", category: "책상", name: "책상", visual: "desk" },

  // 의자
  { id: "desk-chair", category: "의자", name: "책상 의자", visual: "chair" },

  // 선반
  { id: "bookshelf", category: "선반", name: "책장 / 오픈 선반", visual: "bookshelf" },
  { id: "hanger", category: "선반", name: "행거", visual: "hanger" },
  { id: "partition", category: "선반", name: "파티션 · 양면 선반", visual: "partition" },

  // 수납
  { id: "wardrobe", category: "수납", name: "옷장", visual: "wardrobe" },
  { id: "drawer", category: "수납", name: "서랍장", visual: "drawer" },
  { id: "tv-console", category: "수납", name: "TV장 / 미디어 콘솔", visual: "tvStand" },

  // 전자기기
  { id: "monitor", category: "전자기기", name: "모니터", visual: "monitor" },
  { id: "tv", category: "전자기기", name: "TV", visual: "tv" },

  // 조명
  { id: "mood-light", category: "조명", name: "무드등", visual: "lamp" },

  // 데코
  { id: "rug", category: "데코", name: "러그", visual: "rug" },
  { id: "plant", category: "데코", name: "화분", visual: "plant" },
  { id: "mirror", category: "데코", name: "전신거울", visual: "mirror" },
  { id: "curtain", category: "데코", name: "커튼 · 블라인드", visual: "curtain" },
];

export default function AddFurniture() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (!sessionStorage.getItem(addFurnitureVisitedKey)) {
      localStorage.removeItem("roomfit:selectedAdditionalFurnitureIds");
      sessionStorage.setItem(addFurnitureVisitedKey, "true");
      return [];
    }

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
      ? furnitureItems
      : furnitureItems.filter((item) => item.category === activeCategory);

  useEffect(() => {
    localStorage.setItem("roomfit:selectedAdditionalFurnitureIds", JSON.stringify(selectedIds));
  }, [selectedIds]);

  const toggleFurniture = (id: string) => {
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

        <div className="grid gap-8 lg:grid-cols-[112px_1fr]">
          <aside>
            <nav className="flex gap-2 overflow-x-auto rounded-xl bg-[#f2f2f2] p-2 lg:flex-col lg:overflow-visible">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-lg px-4 py-3 text-left text-sm font-extrabold transition-colors ${
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

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleFurniture(item.id)}
                    className={`relative rounded-lg border bg-white p-3 text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(0,0,0,0.08)] ${
                      selected ? "border-[#111111]" : "border-transparent"
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

