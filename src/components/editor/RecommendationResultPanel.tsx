import { FiAlertTriangle, FiArrowLeft } from "react-icons/fi";

import {
  getUnplacedFurnitureMessage,
  type RecommendationResultNotice,
} from "../../config/recommendationResult";

interface RecommendationResultPanelProps {
  notice: RecommendationResultNotice;
  onReturnToFurniture?: () => void;
}

export default function RecommendationResultPanel({
  notice,
  onReturnToFurniture,
}: RecommendationResultPanelProps) {
  const isPartial = notice.status === "PARTIAL_SUCCESS";
  const hasCounts = notice.requestedFurnitureCount !== undefined
    && notice.placedFurnitureCount !== undefined;

  return (
    <section
      role="status"
      className={`rounded-lg border p-5 ${
        isPartial
          ? "border-[#f0d28b] bg-[#fff9e9] text-[#6f4d00]"
          : "border-[#f3b7b7] bg-[#fff5f5] text-[#8f2323]"
      }`}
    >
      <div className="flex items-start gap-3">
        <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold">
            {isPartial ? "일부 가구만 배치했어요" : "가구를 배치하지 못했어요"}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6">{notice.message}</p>

          {hasCounts && (
            <p className="mt-3 text-sm font-extrabold">
              요청 {notice.requestedFurnitureCount}개 중 {notice.placedFurnitureCount}개 배치
            </p>
          )}

          {notice.unplacedFurniture.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm font-semibold">
              {notice.unplacedFurniture.map((item) => (
                <li key={`${item.requestIndex}-${item.furnitureType}-${item.productId ?? "-"}`}>
                  <span className="font-extrabold">{item.furnitureType}</span>
                  <span className="mx-1">·</span>
                  {getUnplacedFurnitureMessage(item)}
                </li>
              ))}
            </ul>
          )}

          {onReturnToFurniture && (
            <button
              type="button"
              onClick={onReturnToFurniture}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-current bg-white px-4 py-2 text-sm font-extrabold transition-opacity hover:opacity-75"
            >
              <FiArrowLeft aria-hidden="true" />
              가구 선택으로 돌아가기
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
