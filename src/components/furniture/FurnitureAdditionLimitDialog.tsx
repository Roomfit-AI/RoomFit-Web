import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";

interface FurnitureAdditionLimitDialogProps {
  onClose(): void;
}

export default function FurnitureAdditionLimitDialog({ onClose }: FurnitureAdditionLimitDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5 py-10">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="furniture-addition-limit-title"
        aria-describedby="furniture-addition-limit-description"
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl sm:p-8"
      >
        <h2 id="furniture-addition-limit-title" className="text-2xl font-extrabold text-[#151515]">
          현재 공간에 가구가 너무 많아요
        </h2>
        <p
          id="furniture-addition-limit-description"
          className="mt-4 whitespace-pre-line text-sm font-medium leading-7 text-[#555555]"
        >
          {"한 번에 최대 8개의 가구를 추가할 수 있으며,\n기존 가구를 포함해 전체 가구는 최대 12개까지 배치할 수 있습니다.\n선택한 가구 수를 줄인 뒤 다시 시도해 주세요."}
        </p>
        <div className="mt-7 flex justify-end">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#111111] px-7 py-3 text-sm font-bold text-white transition-opacity hover:opacity-80"
          >
            가구 다시 선택하기
          </button>
        </div>
      </section>
    </div>
  );
}
