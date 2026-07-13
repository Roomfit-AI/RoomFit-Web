import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import PageStepHeader from "../components/ui/PageStepHeader";

const styles = [
  { id: "minimal", title: "미니멀", tone: "white" },
  { id: "natural", title: "내추럴", tone: "wood" },
  { id: "modern", title: "모던", tone: "light" },
  { id: "classic", title: "클래식", tone: "cream" },
  { id: "midcentury", title: "미드센추리", tone: "deep" },
];

export default function ReferenceImage() {
  const [selectedStyle, setSelectedStyle] = useState(() => {
    return localStorage.getItem("roomfit:selectedStyle") ?? "minimal";
  });

  useEffect(() => {
    localStorage.setItem("roomfit:selectedStyle", selectedStyle);
  }, [selectedStyle]);

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] px-5 py-8 text-[#141414] sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <PageStepHeader step={4} title="레퍼런스 이미지 선택" className="mb-12" />

        <header className="mb-20 text-center">
          <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">마음에 드는 인테리어 이미지를 선택해주세요</h1>
          <p className="mt-3 text-sm font-semibold text-[#777777]">선택한 이미지는 AI 추천 스타일에 반영됩니다.</p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {styles.map((style) => {
            const selected = selectedStyle === style.id;

            return (
              <button key={style.id} type="button" onClick={() => setSelectedStyle(style.id)} className="group text-left">
                <span
                  className={`relative block overflow-hidden rounded-lg border bg-white p-2 transition-all group-hover:-translate-y-1 group-hover:shadow-[0_18px_35px_rgba(0,0,0,0.08)] ${
                    selected ? "border-[#111111] ring-2 ring-[#111111]" : "border-[#e5e5e5]"
                  }`}
                >
                  {selected && (
                    <span className="absolute right-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full bg-[#111111] text-white">
                      <FiCheck className="h-4 w-4" />
                    </span>
                  )}
                  <RoomStylePreview tone={style.tone} />
                </span>
                <strong className="mt-4 block text-center text-sm font-extrabold">{style.title}</strong>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function RoomStylePreview({ tone }: { tone: string }) {
  return (
    <div className={`room-preview room-preview-${tone} h-44`}>
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
