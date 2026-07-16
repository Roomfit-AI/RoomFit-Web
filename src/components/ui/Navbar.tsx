import { useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";
import { confirmLayout as confirmLayoutOnBackend } from "../../api/layouts";
import { resolveCurrentRoomLayout, saveConfirmedLayout } from "../../config/confirmedLayouts";

const navigationSteps = [
  { path: "/", label: "홈" },
  {
    path: "/rooms",
    label: "샘플 선택",
    beforeNext: ensureSelectedRoom,
  },
  { path: "/manage-furniture", label: "가구 관리" },
  { path: "/preference", label: "취향 선택" },
  { path: "/reference-image", label: "이미지 선택" },
  { path: "/add-furniture", label: "가구 선택" },
  { path: "/editor", label: "편집" },
  { path: "/layout-confirm", label: "결과 확인" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentStepIndex = navigationSteps.findIndex((step) => step.path === location.pathname);
  const safeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const isHome = safeStepIndex === 0;
  const isLastStep = safeStepIndex === navigationSteps.length - 1;
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

    if (isLastStep) {
      // Mirrors LayoutConfirm.tsx's own "확정하기" button — this navbar button
      // relabels itself to "확정하기" on the last step (see the render below),
      // so clicking it here needs to actually persist the result too, not
      // just the in-page button.
      const layout = resolveCurrentRoomLayout();
      saveConfirmedLayout(layout.id, layout);

      const rawLayoutId = localStorage.getItem("roomfit:backendLayoutId");
      const backendLayoutId = Number(rawLayoutId);

      if (rawLayoutId && Number.isFinite(backendLayoutId) && backendLayoutId > 0) {
        confirmLayoutOnBackend(backendLayoutId).catch((error) => {
          console.error("배치를 백엔드에서 확정하지 못했습니다.", error);
        });
      }

      return;
    }

    if (nextStep) {
      navigate(nextStep.path);
    }
  };

  return (
    <nav className="fixed inset-x-0 top-0 z-30 h-19 border-b border-[#e8e8e8] bg-[#fbfbfb]">
      <div className="flex h-full items-center justify-between px-10">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-xl font-bold tracking-[0.02em] text-[#181818] transition-opacity hover:opacity-70 sm:text-2xl cursor-pointer"
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

          {/* LayoutConfirm.tsx has its own in-page "확정하기" button inside the
              요약 정보 aside, which also handles the thumbnail capture on
              confirm — keeping this navbar one too just doubled the button. */}
          {nextStep && !isLastStep && (
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
}
