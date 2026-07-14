import { categoryLabels, purposeOptions, styleOptions } from "../../mock/interiorPlacementMock";
import type { AgentContext, ValidationResult } from "../../types";

export function InlineBack({ onPrevious }: { onPrevious: () => void }) {
  return (
    <button className="inline-back" type="button" onClick={onPrevious}>
      이전 단계
    </button>
  );
}

export function PageAction({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="page-action">
      <button className="primary-button" type="button" onClick={onClick} disabled={disabled}>
        {label}
      </button>
    </div>
  );
}

export function ValidationDashboard({ results }: { results: ValidationResult[] }) {
  return (
    <div className="validation-list">
      {results.map((result) => (
        <article key={result.id} className={`validation-item ${result.severity}`}>
          <div>
            <strong>{result.label}</strong>
            <p>{result.message}</p>
          </div>
          <span>{result.severity === "pass" ? "통과" : "주의"}</span>
        </article>
      ))}
    </div>
  );
}

export function AgentPayloadPreview({ context }: { context: AgentContext | null }) {
  if (!context) {
    return <div className="payload-preview muted">아직 추천 배치가 생성되지 않았습니다.</div>;
  }

  return (
    <div className="payload-preview">
      <strong>생성된 추천 컨텍스트</strong>
      <span>생활 목적: {translatePurpose(context.preference.purpose)}</span>
      <span>디자인 취향: {translateStyle(context.preference.style)}</span>
      <span>필요 가구: {context.preference.requiredItems.map((item) => categoryLabels[item]).join(", ")}</span>
      <span>참고 이미지: {context.selectedInspirations.map((image) => image.title).join(", ")}</span>
    </div>
  );
}

function translatePurpose(purpose: AgentContext["preference"]["purpose"]): string {
  return purposeOptions.find((option) => option.id === purpose)?.label ?? purpose;
}

function translateStyle(style: AgentContext["preference"]["style"]): string {
  return styleOptions.find((option) => option.id === style)?.label ?? style;
}
