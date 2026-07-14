import { useEffect, useState } from "react";
import { FiBookOpen, FiBriefcase, FiCheck, FiCoffee, FiGrid, FiHeart, FiHome, FiMoon, FiPackage, FiSmile } from "react-icons/fi";
import PageStepHeader from "../components/ui/PageStepHeader";

const purposes = [
  { id: "rest", title: "휴식", description: "편안하게 쉴 수 있는 목적", icon: FiCoffee },
  { id: "work", title: "업무 / 공부", description: "집중할 수 있는 공간", icon: FiBriefcase },
  { id: "exercise", title: "운동", description: "홈트레이닝 공간", icon: FiGrid },
  { id: "cook", title: "요리", description: "요리를 즐겨해요", icon: FiPackage },
  { id: "party", title: "모임 / 접객", description: "사람들을 초대해요", icon: FiSmile },
  { id: "hobby", title: "취미 / 수집", description: "취미 생활을 즐겨요", icon: FiBookOpen },
  { id: "kids", title: "아이와 함께", description: "아이 중심의 공간", icon: FiHeart },
  { id: "pet", title: "반려동물", description: "반려동물과 함께해요", icon: FiHome },
  { id: "etc", title: "기타", description: "기타 목적", icon: FiMoon },
];

// Two-word titles ("A / B") get one color per word, split half-and-half in
// the swatch below — a single title-word (그레이) keeps a single color
// instead of forcing an arbitrary second shade that isn't in the label.
const palettes = [
  { id: "ivory", title: "화이트 / 아이보리", colors: ["#ffffff", "#f0e6d2"] },
  { id: "beige", title: "베이지 / 샌드", colors: ["#d9c8ad", "#e3cba0"] },
  { id: "gray", title: "그레이", colors: ["#b9b9b9"] },
  { id: "brown", title: "브라운 / 우드", colors: ["#6b4a35", "#b08968"] },
  { id: "green", title: "그린 / 올리브", colors: ["#3f6b44", "#6b6b3f"] },
  { id: "blue", title: "블루 / 네이비", colors: ["#3a5a8c", "#152238"] },
  { id: "pink", title: "핑크 / 코랄", colors: ["#f0b8c8", "#e8735a"] },
  { id: "black", title: "블랙 / 다크", colors: ["#0a0a0a", "#2b2b2b"] },
];
const preferenceVisitedKey = "roomfit:visited:preference";

export default function Preference() {
  const [selectedPurpose, setSelectedPurpose] = useState(() => {
    return getInitialPreferenceValue("roomfit:selectedPurpose");
  });
  const [selectedPalette, setSelectedPalette] = useState(() => {
    return getInitialPreferenceValue("roomfit:selectedPalette");
  });

  useEffect(() => {
    if (selectedPurpose) {
      localStorage.setItem("roomfit:selectedPurpose", selectedPurpose);
    } else {
      localStorage.removeItem("roomfit:selectedPurpose");
    }

    if (selectedPalette) {
      localStorage.setItem("roomfit:selectedPalette", selectedPalette);
    } else {
      localStorage.removeItem("roomfit:selectedPalette");
    }
  }, [selectedPurpose, selectedPalette]);

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] px-5 py-8 text-[#141414] sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <PageStepHeader step={3} title="라이프 스타일 및 선호하는 디자인 선택" className="mb-12" />

        <header className="mb-12 text-center">
          <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">당신의 라이프스타일과 선호하는 색감을 알려주세요</h1>
          <p className="mt-3 text-sm font-semibold text-[#777777]">정확한 추천을 위해 생활 패턴을 입력해주세요.</p>
        </header>

        <section className="mb-10">
          <h2 className="mb-4 text-base font-extrabold">라이프 스타일</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {purposes.map((purpose) => {
              const Icon = purpose.icon;
              const selected = selectedPurpose === purpose.id;

              return (
                <button
                  key={purpose.id}
                  type="button"
                  onClick={() => setSelectedPurpose(purpose.id)}
                  className={`relative flex items-center gap-4 rounded-lg border bg-white px-5 py-4 text-left transition-all hover:border-[#111111] ${
                    selected ? "border-[#111111] shadow-[0_14px_28px_rgba(0,0,0,0.08)]" : "border-[#e5e5e5]"
                  }`}
                >
                  {selected && (
                    <span className="absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full bg-[#111111] text-white">
                      <FiCheck className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <Icon className="h-7 w-7 shrink-0 stroke-[1.5]" />
                  <span>
                    <strong className="block text-base font-extrabold">{purpose.title}</strong>
                    <span className="mt-1 block text-sm font-medium text-[#777777]">{purpose.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-base font-extrabold">선호하는 색감 톤</h2>
          <div className="grid gap-5 sm:grid-cols-4 lg:grid-cols-8">
            {palettes.map((palette) => {
              const selected = selectedPalette === palette.id;

              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => setSelectedPalette(palette.id)}
                  className="flex flex-col items-center gap-3 text-center"
                >
                  <span
                    className={`relative grid h-14 w-14 place-items-center rounded-full border transition-all ${
                      selected ? "border-[#111111] ring-4 ring-[#eeeeee]" : "border-[#dddddd]"
                    }`}
                    style={{
                      background:
                        palette.colors.length > 1
                          ? `linear-gradient(135deg, ${palette.colors[0]} 0 50%, ${palette.colors[1]} 50% 100%)`
                          : palette.colors[0],
                    }}
                  >
                    {selected && <FiCheck className="h-5 w-5 text-white mix-blend-difference" />}
                  </span>
                  <span className="text-xs font-bold text-[#333333]">{palette.title}</span>
                </button>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

function getInitialPreferenceValue(key: string) {
  if (!sessionStorage.getItem(preferenceVisitedKey)) {
    localStorage.removeItem("roomfit:selectedPurpose");
    localStorage.removeItem("roomfit:selectedPalette");
    sessionStorage.setItem(preferenceVisitedKey, "true");
    return "";
  }

  return localStorage.getItem(key) ?? "";
}
