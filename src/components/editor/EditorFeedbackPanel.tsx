import FeedbackAgentResultPanel from "./FeedbackAgentResultPanel";
import type { FeedbackResultState } from "./feedbackResultState";

interface EditorFeedbackPanelProps {
  layoutReady: boolean;
  feedback: string;
  isApplyingFeedback: boolean;
  isRecommending: boolean;
  result: FeedbackResultState;
  onFeedbackChange: (value: string) => void;
  onApplyFeedback: () => void;
  onRecommend: () => void;
  onSelectCandidate?: (furnitureId: string) => void;
}

export default function EditorFeedbackPanel({
  layoutReady,
  feedback,
  isApplyingFeedback,
  isRecommending,
  result,
  onFeedbackChange,
  onApplyFeedback,
  onRecommend,
  onSelectCandidate,
}: EditorFeedbackPanelProps) {
  const hasResult = isApplyingFeedback || result.presentation?.showPanel || Boolean(result.errorMessage);

  return (
    <section data-editor-section="feedback" className="rounded-xl border border-[#e6e6e6] bg-white p-5">
      <h2 className="text-lg font-extrabold">AI 피드백</h2>
      {!layoutReady ? (
        <div className="mt-4 rounded-lg border border-dashed border-[#d8d8d8] bg-[#f7f7f7] p-4">
          <strong className="block text-sm font-extrabold text-[#333333]">먼저 AI 추천 배치를 생성해 주세요</strong>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#777777]">
            추천 배치가 만들어진 뒤에 원하는 변경사항을 피드백으로 반영할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={onRecommend}
            disabled={isRecommending}
            className="mt-4 w-full rounded-lg bg-[#111111] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#999999]"
          >
            {isRecommending ? "AI 추천 생성 중..." : "AI 추천 생성하기"}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium leading-6 text-[#777777]">
            자연어 피드백을 LLM이 intent로 해석하고, 백엔드 규칙 기반 로직이 배치에 반영합니다.
          </p>

          <textarea
            value={feedback}
            onChange={(event) => onFeedbackChange(event.target.value)}
            disabled={isApplyingFeedback}
            aria-busy={isApplyingFeedback}
            className="mt-4 min-h-28 w-full resize-none rounded-lg border border-[#dddddd] bg-[#fbfbfb] p-4 text-sm font-semibold outline-none focus:border-[#111111]"
            placeholder="(예) 책상을 조금 더 넓게 쓰고 싶어"
          />

          <button
            type="button"
            onClick={onApplyFeedback}
            disabled={isApplyingFeedback}
            className="mt-3 w-full rounded-lg bg-[#111111] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#bbbbbb]"
          >
            {isApplyingFeedback ? "피드백 반영 중..." : "피드백 반영"}
          </button>
        </>
      )}

      <div
        aria-live="polite"
        aria-atomic="true"
        data-feedback-result-region
        className={hasResult ? "mt-4" : ""}
      >
        {isApplyingFeedback && (
          <p role="status" className="rounded-lg bg-[#f4f4f4] px-4 py-3 text-sm font-bold text-[#555555]">
            피드백을 반영하고 있습니다.
          </p>
        )}
        {!isApplyingFeedback && result.presentation?.showPanel && (
          <FeedbackAgentResultPanel
            presentation={result.presentation}
            onSelectCandidate={onSelectCandidate}
            isSelectingCandidate={isApplyingFeedback}
          />
        )}
        {!isApplyingFeedback && result.errorMessage && (
          <section role="alert" className="rounded-xl border border-[#ffd8d8] bg-[#fff5f5] p-4 text-sm font-bold text-[#c0392b]">
            {result.errorMessage}
          </section>
        )}
      </div>
    </section>
  );
}
