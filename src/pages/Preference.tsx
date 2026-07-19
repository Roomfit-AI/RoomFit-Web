import { useEffect, useState } from "react";
import { FiBookOpen, FiBriefcase, FiCheck, FiCoffee, FiHome } from "react-icons/fi";
import PageStepHeader from "../components/ui/PageStepHeader";
import InlineSelectionValidation from "../components/ui/InlineSelectionValidation";
import {
  normalizePreferredColorToneId,
  PREFERRED_COLOR_TONE_OPTIONS,
  type PreferredColorToneId,
} from "../config/preferredColorTone";
import {
  hasRoomPreferences,
  shouldClearInitialPreferences,
} from "../config/roomPreferences";
import {
  getPreferenceGuidanceMessage,
  normalizeLifestyleId,
  notifyOnboardingSelectionChanged,
  ONBOARDING_VALIDATION_EVENT,
} from "../config/onboardingSelection";

const purposes = [
  { id: "rest", title: "휴식", description: "편안하게 쉴 수 있는 목적", icon: FiCoffee },
  { id: "work", title: "업무 / 공부", description: "집중할 수 있는 공간", icon: FiBriefcase },
  { id: "hobby", title: "취미 / 여가", description: "취미 생활을 즐겨요", icon: FiBookOpen },
  { id: "storage", title: "수납", description: "수납을 많이 할 수 있는 목적", icon: FiHome },
];

const preferenceVisitedKey = "roomfit:visited:preference";

export default function Preference() {
  const [initialPreferences] = useState(getInitialPreferenceValues);
  const [selectedPurpose, setSelectedPurpose] = useState(initialPreferences.purpose);
  const [selectedPalette, setSelectedPalette] = useState<PreferredColorToneId | "">(
    initialPreferences.palette,
  );
  const [validationMessage, setValidationMessage] = useState("");

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

    // 선택이 바뀌었으니 같은 탭의 Navbar가 "다음 단계" 버튼 활성화 여부를
    // 다시 계산하도록 알린다.
    notifyOnboardingSelectionChanged();
  }, [selectedPurpose, selectedPalette]);

  useEffect(() => {
    const showValidation = (event: Event) => {
      const detail = (event as CustomEvent<{ pathname?: string }>).detail;
      if (detail?.pathname !== "/preference") return;
      setValidationMessage(getPreferenceGuidanceMessage({
        purpose: normalizeLifestyleId(selectedPurpose),
        palette: normalizePreferredColorToneId(selectedPalette),
      }));
    };
    window.addEventListener(ONBOARDING_VALIDATION_EVENT, showValidation);
    return () => window.removeEventListener(ONBOARDING_VALIDATION_EVENT, showValidation);
  }, [selectedPalette, selectedPurpose]);

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] px-5 py-8 text-[#141414] sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <PageStepHeader step={3} title="라이프 스타일 및 선호하는 디자인 선택" className="mb-12" />

        <header className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">당신의 라이프스타일과 선호하는 색감을 알려주세요</h1>
          <p className="mt-3 text-sm font-semibold text-[#777777]">정확한 추천을 위해 생활 패턴을 입력해주세요.</p>
        </header>

        <InlineSelectionValidation message={validationMessage} />

        <section className="mb-10">
          <h2 className="mb-4 text-base font-extrabold">라이프스타일</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {purposes.map((purpose) => {
              const Icon = purpose.icon;
              const selected = selectedPurpose === purpose.id;

              return (
                <button
                  key={purpose.id}
                  type="button"
                  onClick={() => { setSelectedPurpose(purpose.id); setValidationMessage(""); }}
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
            {PREFERRED_COLOR_TONE_OPTIONS.map((palette) => {
              const selected = selectedPalette === palette.id;

              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => { setSelectedPalette(palette.id); setValidationMessage(""); }}
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
                  <span className="text-xs font-bold text-[#333333]">{palette.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

function getInitialPreferenceValues(): {
  purpose: string;
  palette: PreferredColorToneId | "";
} {
  const hasVisitedPreferencePage = Boolean(sessionStorage.getItem(preferenceVisitedKey));
  const selectedRoomId = localStorage.getItem("roomfit:selectedRoomId");
  const hasRestoredRoomPreferences = selectedRoomId
    ? hasRoomPreferences(selectedRoomId)
    : false;

  if (shouldClearInitialPreferences(hasVisitedPreferencePage, hasRestoredRoomPreferences)) {
    localStorage.removeItem("roomfit:selectedPurpose");
    localStorage.removeItem("roomfit:selectedPalette");
  }

  if (!hasVisitedPreferencePage) {
    sessionStorage.setItem(preferenceVisitedKey, "true");
  }

  // 복원 값도 지원하는 유효 id일 때만 선택으로 인정한다 — 빈 문자열/지원하지
  // 않는 값/오래된 값은 미선택("")으로 두고, 첫 번째 옵션으로 임의 치환하지 않는다.
  return {
    purpose: normalizeLifestyleId(localStorage.getItem("roomfit:selectedPurpose")) ?? "",
    palette: normalizePreferredColorToneId(localStorage.getItem("roomfit:selectedPalette")) ?? "",
  };
}
