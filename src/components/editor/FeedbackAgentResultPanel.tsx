import { FiAlertTriangle, FiCheckCircle, FiHelpCircle, FiXCircle } from "react-icons/fi";

import type { FeedbackOperationStatus, FeedbackStatus } from "../../api/layouts";
import {
  getFeedbackOperationLabel,
  getFeedbackReasonMessage,
  type FeedbackPresentation,
} from "./feedbackPresentation";

const STATUS_DETAILS: Record<FeedbackStatus, {
  label: string;
  title: string;
  className: string;
  icon: typeof FiCheckCircle;
}> = {
  SUCCESS: {
    label: "전체 반영",
    title: "요청을 모두 반영했습니다.",
    className: "border-[#cfe8d5] bg-[#f4fbf6] text-[#176b35]",
    icon: FiCheckCircle,
  },
  PARTIAL_SUCCESS: {
    label: "부분 반영",
    title: "일부 요청을 반영했습니다.",
    className: "border-[#f0ddb3] bg-[#fffaf0] text-[#8a5a00]",
    icon: FiAlertTriangle,
  },
  FAILED: {
    label: "반영 실패",
    title: "배치 변경을 적용하지 못했습니다.",
    className: "border-[#f1cece] bg-[#fff6f6] text-[#a33a32]",
    icon: FiXCircle,
  },
  NEEDS_CLARIFICATION: {
    label: "정보 필요",
    title: "추가 정보가 필요합니다.",
    className: "border-[#cfdcf2] bg-[#f5f8fd] text-[#315f9b]",
    icon: FiHelpCircle,
  },
};

const OPERATION_STATUS_LABELS: Record<FeedbackOperationStatus, string> = {
  APPLIED: "반영됨",
  FAILED: "반영 실패",
  SKIPPED_DEPENDENCY: "건너뜀",
  NEEDS_CLARIFICATION: "정보 필요",
};

const OPERATION_STATUS_CLASSES: Record<FeedbackOperationStatus, string> = {
  APPLIED: "bg-[#e9f6ed] text-[#176b35]",
  FAILED: "bg-[#fdecec] text-[#a33a32]",
  SKIPPED_DEPENDENCY: "bg-[#f2f2f2] text-[#666666]",
  NEEDS_CLARIFICATION: "bg-[#eaf1fb] text-[#315f9b]",
};

export default function FeedbackAgentResultPanel({
  presentation,
}: {
  presentation: FeedbackPresentation;
}) {
  if (!presentation.showPanel || !presentation.feedbackStatus) return null;

  const statusDetails = STATUS_DETAILS[presentation.feedbackStatus];
  const StatusIcon = statusDetails.icon;
  const countSummary = presentation.feedbackStatus === "PARTIAL_SUCCESS"
    && presentation.operationResults.length > 0
    ? `${presentation.operationResults.length}개 중 ${presentation.appliedCount}개 반영 · 실패 ${presentation.failedCount}개 · 보류 ${presentation.pendingCount}개`
    : null;

  return (
    <section
      aria-live="polite"
      aria-label="피드백 처리 결과"
      className={`rounded-xl border p-5 ${statusDetails.className}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <StatusIcon aria-hidden="true" className="mt-0.5 shrink-0 text-xl" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-extrabold">{statusDetails.label}</span>
          <h2 className="mt-1 text-base font-extrabold text-[#222222]">{countSummary ?? statusDetails.title}</h2>
          {presentation.summaryMessage && presentation.summaryMessage !== countSummary && (
            <p className="mt-2 break-words text-sm font-semibold leading-6 text-[#555555]">
              {presentation.summaryMessage}
            </p>
          )}
        </div>
      </div>

      {presentation.operationResults.length > 0 && (
        <div className="mt-5 border-t border-current/15 pt-4">
          <h3 className="text-sm font-extrabold text-[#333333]">작업별 결과</h3>
          <ol className="mt-3 divide-y divide-[#e5e5e5]">
            {presentation.operationResults.map((operation, index) => {
              const furnitureId = operation.resultFurnitureId ?? operation.targetFurnitureId;
              return (
                <li key={`${operation.operationId}-${index}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <strong className="min-w-0 break-words text-sm text-[#222222]">
                      {index + 1}. {getFeedbackOperationLabel(operation.operationType)}
                    </strong>
                    <span className={`shrink-0 rounded px-2 py-1 text-[11px] font-extrabold ${OPERATION_STATUS_CLASSES[operation.status]}`}>
                      {OPERATION_STATUS_LABELS[operation.status]}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold leading-6 text-[#555555]">
                    {operation.message}
                  </p>
                  {operation.reasonCode && (
                    <p className="mt-1 break-words text-xs font-semibold leading-5 text-[#666666]">
                      {getFeedbackReasonMessage(operation.reasonCode)}
                    </p>
                  )}
                  {furnitureId && (
                    <p className="mt-1 truncate text-[11px] font-medium text-[#888888]" title={furnitureId}>
                      대상 ID: {furnitureId}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {presentation.clarifications.length > 0 && (
        <div className="mt-5 border-t border-current/15 pt-4">
          <h3 className="text-sm font-extrabold text-[#333333]">확인이 필요해요</h3>
          <div className="mt-3 space-y-4">
            {presentation.clarifications.map((clarification, clarificationIndex) => (
              <section key={`${clarification.operationId ?? "plan"}-${clarificationIndex}`}>
                <p className="break-words text-base font-extrabold leading-6 text-[#222222]">
                  {clarification.question}
                </p>
                {clarification.candidates && clarification.candidates.length > 0 && (
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                    {clarification.candidates.map((candidate, candidateIndex) => (
                      <li
                        key={`${candidate.furnitureId}-${candidateIndex}`}
                        className="rounded-lg border border-[#dbe3ef] bg-white/70 px-3 py-2 text-sm font-bold text-[#333333]"
                      >
                        {candidate.label || candidate.type || candidate.furnitureId}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#666666]">
            대상을 구체적으로 적어 다시 요청해 주세요.
          </p>
        </div>
      )}
    </section>
  );
}
