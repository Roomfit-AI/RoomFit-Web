import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";
import {
  canAdvanceFromPath,
  ONBOARDING_SELECTION_EVENT,
} from "../../config/onboardingSelection";
import { getFurnitureAdditionErrorMessage } from "../../config/furnitureAdditionError";

interface NavigationStep {
  path: string;
  label: string;
  beforeNext?: () => Promise<unknown> | unknown;
}

const navigationSteps: NavigationStep[] = [
  {
    path: "/",
    label: "홈",
    beforeNext: async () => (await import("../../config/roomSetupSession")).beginNewRoomSetup(),
  },
  {
    path: "/rooms",
    label: "샘플 선택",
    beforeNext: async () => (await import("../../config/roomSetupSession")).prepareSelectedRoomForManagement(),
  },
  {
    path: "/manage-furniture",
    label: "가구 관리",
    beforeNext: async () => (await import("../../config/layoutEditingWorkflow")).prepareManagedFurnitureDraft(),
  },
  {
    path: "/preference",
    label: "취향 선택",
    beforeNext: async () => (await import("../../config/layoutEditingWorkflow")).refreshActiveDraftNavigationState(),
  },
  {
    path: "/reference-image",
    label: "이미지 선택",
    beforeNext: async () => (await import("../../config/layoutEditingWorkflow")).refreshActiveDraftNavigationState(),
  },
  {
    path: "/add-furniture",
    label: "가구 선택",
    beforeNext: async () => (await import("../../config/layoutEditingWorkflow")).prepareAdditionalFurnitureForEditor(),
  },
  {
    path: "/editor",
    label: "편집",
    beforeNext: async () => (await import("../../config/layoutEditingWorkflow")).persistActiveEditorLayout(),
  },
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
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationError, setNavigationError] = useState("");
  const navigationInFlightRef = useRef(false);
  // /preference·/reference-image에서 필수 선택이 끝났는지. 게이트 대상이 아닌
  // 단계에서는 항상 true라 기존 이동 동작에 영향이 없다.
  const [canAdvance, setCanAdvance] = useState(() => canAdvanceFromPath(location.pathname));

  useEffect(() => {
    const update = () => setCanAdvance(canAdvanceFromPath(location.pathname));
    // 새로고침/뒤로 가기/URL 직접 진입(경로 변경)마다, 그리고 페이지에서 선택이
    // 바뀔 때(같은 탭 커스텀 이벤트)마다 다시 계산한다. storage 이벤트는 다른
    // 탭에서의 변경까지 커버한다.
    update();
    window.addEventListener(ONBOARDING_SELECTION_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(ONBOARDING_SELECTION_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!["/preference", "/reference-image", "/add-furniture"].includes(location.pathname)) {
      return;
    }

    let cancelled = false;
    import("../../config/layoutEditingWorkflow")
      .then(({ refreshActiveDraftNavigationState }) => refreshActiveDraftNavigationState())
      .then((state) => {
        if (!cancelled && state) {
          navigate(location.pathname, { replace: true, state });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNavigationError("편집 중인 배치를 불러오지 못했습니다. 이전 단계에서 다시 시도해 주세요.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  const goPrevious = () => {
    if (previousStep) {
      navigate(previousStep.path, { state: location.state });
    }
  };

  const goNext = async () => {
    if (navigationInFlightRef.current) return;
    // 버튼 disabled와 별개로, navigation handler에서도 필수 선택을 다시 확인한다
    // (키보드/포커스 타이밍 등으로 disabled를 우회한 호출까지 막기 위해).
    if (!canAdvanceFromPath(location.pathname)) return;
    navigationInFlightRef.current = true;
    const currentStep = navigationSteps[safeStepIndex];
    setIsNavigating(true);
    setNavigationError("");

    try {
      const nextState = await currentStep.beforeNext?.();

      if (nextStep) {
        navigate(nextStep.path, { state: nextState ?? location.state });
      }
    } catch (error) {
      const furnitureAdditionMessage = getFurnitureAdditionErrorMessage(error);
      if (furnitureAdditionMessage) {
        setNavigationError(furnitureAdditionMessage);
      } else if (error instanceof Error && error.name === "AgentContextRequestValidationError") {
        setNavigationError(error.message);
      } else if (!(error instanceof Error && error.name === "RecommendationFeasibilityError")) {
        setNavigationError(
          location.pathname === "/rooms"
            ? "새 방을 만들지 못했습니다. 현재 선택을 유지한 채 다시 시도해 주세요."
            : location.pathname === "/add-furniture"
              ? "추천 서버에 연결하지 못했습니다. 선택한 가구를 유지한 채 다시 시도해 주세요."
              : "배치를 저장하지 못했습니다. 현재 화면에서 다시 시도해 주세요.",
        );
      }
    } finally {
      setIsNavigating(false);
      navigationInFlightRef.current = false;
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
            <Button onClick={goNext} disabled={isNavigating || !canAdvance} className="hidden px-7 py-2.5 sm:inline-flex">
              {isNavigating
                ? location.pathname === "/add-furniture" ? "추천 생성 중..." : "저장 중..."
                : isHome ? "시작하기" : "다음 단계"}
            </Button>
          )}
        </div>
      </div>
      {navigationError && (
        <p role="alert" className="absolute right-10 top-[70px] rounded-lg bg-[#fff1f1] px-4 py-3 text-sm font-bold text-[#b42318] shadow">
          {navigationError}
        </p>
      )}
    </nav>
  );
}
