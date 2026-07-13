import { useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";

const navigationSteps = [
  { path: "/", label: "홈" },
  {
    path: "/rooms",
    label: "샘플 선택",
    beforeNext: ensureSelectedRoom,
  },
  { path: "/manage-furniture", label: "가구 관리" },
  { path: "/preference", label: "취향 선택" },
  { path: "/add-furniture", label: "가구 선택" },
  { path: "/editor", label: "편집" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentStepIndex = navigationSteps.findIndex((step) => step.path === location.pathname);
  const safeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const isHome = safeStepIndex === 0;
  const previousStep = navigationSteps[safeStepIndex - 1];
  const nextStep = navigationSteps[safeStepIndex + 1];

  const goPrevious = () => {
    if (previousStep) {
      navigate(previousStep.path);
    }
  };

  const goNext = () => {
    const currentStep = navigationSteps[safeStepIndex];
    currentStep.beforeNext?.();

    if (nextStep) {
      navigate(nextStep.path);
    }
  };

  return (
    <nav className="h-19 border-b border-[#e8e8e8] bg-[#fbfbfb]">
      <div className="flex h-full items-center justify-between px-10">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-xl font-bold tracking-[0.02em] text-[#181818] transition-opacity hover:opacity-70 sm:text-2xl"
        >
          ROOMFIT
        </button>

        <div className="flex items-center gap-3">
          {!isHome && previousStep && (
            <button
              type="button"
              onClick={goPrevious}
              className="hidden items-center justify-center rounded-full border border-[#111111] bg-white px-7 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#f5f5f5] sm:inline-flex"
            >
              이전 단계
            </button>
          )}

          {nextStep && (
            <Button onClick={goNext} className="hidden px-7 py-2.5 sm:inline-flex">
              {isHome ? "시작하기" : "다음 단계"}
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

function ensureSelectedRoom() {
  if (localStorage.getItem("roomfit:selectedRoomId")) {
    return;
  }

  localStorage.setItem("roomfit:selectedRoomId", "studio-1r-sample");
  localStorage.setItem("roomfit:selectedRoomTitle", "오픈형 원룸");
  localStorage.setItem("roomfit:selectedRoomType", "원룸");
  localStorage.setItem("roomfit:selectedRoomSize", "6평");
  localStorage.removeItem("roomfit:selectedRoomLayout");
}
