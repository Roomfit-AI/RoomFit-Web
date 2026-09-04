interface RecommendationGenerationPanelProps {
  roomTitle: string;
  selectedFurnitureCount: number;
  isGenerating: boolean;
  errorMessage: string;
  ready: boolean;
  onGenerate: () => void;
  onPrevious: () => void;
}

export default function RecommendationGenerationPanel({
  roomTitle,
  selectedFurnitureCount,
  isGenerating,
  errorMessage,
  ready,
  onGenerate,
  onPrevious,
}: RecommendationGenerationPanelProps) {
  return (
    <section className="w-full max-w-xl rounded-2xl border border-[#e4e4e4] bg-white p-7 shadow-[0_22px_55px_rgba(0,0,0,0.07)] sm:p-10">
      <span className="text-sm font-extrabold text-[#777777]">참고용 제안</span>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">AI 추천 배치, 참고해 보시겠어요?</h1>
      <p className="mt-4 text-sm font-semibold leading-6 text-[#666666]">
        선택한 공간과 취향, 가구를 바탕으로 배치 하나를 제안해 드려요. 마음에 들지 않으면 다음 화면에서 직접 자유롭게 옮기고 바꿀 수 있으니, 참고용으로 가볍게 생성해 보세요.
      </p>

      <dl className="mt-7 grid gap-3 rounded-xl bg-[#f7f7f7] p-5 text-sm">
        <div className="flex items-center justify-between gap-5">
          <dt className="font-bold text-[#777777]">공간</dt>
          <dd className="truncate font-extrabold text-[#222222]">{roomTitle}</dd>
        </div>
        <div className="flex items-center justify-between gap-5">
          <dt className="font-bold text-[#777777]">선택 가구</dt>
          <dd className="font-extrabold text-[#222222]">{selectedFurnitureCount}개</dd>
        </div>
      </dl>

      <div aria-live="polite" className="mt-5 min-h-0">
        {errorMessage && (
          <p role="alert" className="rounded-lg bg-[#fff1f1] px-4 py-3 text-sm font-bold text-[#b42318]">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
        <button type="button" onClick={onPrevious} disabled={isGenerating} className="flex-1 rounded-full border border-[#111111] bg-white px-6 py-3 text-sm font-extrabold text-[#111111] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-50">
          이전 단계
        </button>
        <button type="button" onClick={onGenerate} disabled={isGenerating || !ready} className="flex-1 rounded-full bg-[#111111] px-6 py-3 text-sm font-extrabold text-white hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#999999]">
          {isGenerating ? "추천 생성 중..." : "AI 추천 생성하기"}
        </button>
      </div>
    </section>
  );
}
