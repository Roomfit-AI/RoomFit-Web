import { useEffect, useState } from "react";
import { FiCheck, FiPlus } from "react-icons/fi";

const categories = ["전체", "소파", "테이블", "의자", "수납장", "조명", "러그", "데코 / 소품", "식물"];

const furnitureItems = [
  { id: "sofa-modern", category: "소파", name: "모던 패브릭 소파", visual: "sofa" },
  { id: "table-round", category: "테이블", name: "라운드 커피테이블", visual: "table" },
  { id: "tv-stand", category: "수납장", name: "우드 TV 장식장", visual: "tvStand" },
  { id: "shelf-open", category: "수납장", name: "오픈 책장", visual: "shelf" },
  { id: "chair-rattan", category: "의자", name: "라탄 암체어", visual: "chair" },
  { id: "dining-table", category: "테이블", name: "우드 다이닝 테이블", visual: "dining" },
  { id: "green-sofa", category: "소파", name: "벨벳 1인 소파", visual: "greenChair" },
  { id: "stool", category: "의자", name: "스툴", visual: "stool" },
  { id: "floor-lamp", category: "조명", name: "플로어 램프", visual: "lamp" },
  { id: "pendant", category: "조명", name: "펜던트 조명", visual: "pendant" },
  { id: "soft-rug", category: "러그", name: "소프트 러그", visual: "rug" },
  { id: "poster", category: "데코 / 소품", name: "액자 / 포스터", visual: "poster" },
  { id: "vase", category: "데코 / 소품", name: "도자기 화병", visual: "vase" },
  { id: "tray", category: "데코 / 소품", name: "우드 트레이", visual: "tray" },
  { id: "diffuser", category: "데코 / 소품", name: "디퓨저", visual: "diffuser" },
  { id: "plant", category: "식물", name: "실내 식물", visual: "plant" },
];

export default function AddFurniture() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const raw = localStorage.getItem("roomfit:selectedAdditionalFurnitureIds");

    if (!raw) {
      return ["floor-lamp", "soft-rug"];
    }

    try {
      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : ["floor-lamp", "soft-rug"];
    } catch {
      return ["floor-lamp", "soft-rug"];
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
        <div className="mb-7 flex items-center gap-4">
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

function FurnitureVisual({ type }: { type: string }) {
  return (
    <div className="relative grid h-36 place-items-center overflow-hidden rounded-lg bg-[#f3f0eb]">
      <div className={`furniture-card-visual furniture-card-${type}`}>
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
