import { FiRotateCcw, FiTrash2 } from "react-icons/fi";

interface SelectedFurnitureActionsProps {
  selectedFurnitureId: string | null;
  selectedFurnitureName?: string;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
}

export default function SelectedFurnitureActions({
  selectedFurnitureId,
  selectedFurnitureName,
  onRotate,
  onDelete,
  onReset,
}: SelectedFurnitureActionsProps) {
  const hasSelection = selectedFurnitureId !== null;

  return (
    <section
      aria-label="선택 가구 편집"
      className="sticky top-22 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8e8e8] bg-white/95 px-4 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.06)] backdrop-blur"
    >
      <div className="min-w-0">
        <span className="block text-xs font-bold text-[#777777]">선택 가구</span>
        <strong className="block max-w-64 truncate text-sm font-extrabold text-[#222222]">
          {hasSelection ? selectedFurnitureName || selectedFurnitureId : "3D 화면에서 가구를 선택해 주세요"}
        </strong>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EditorToolButton
          label="90° 회전"
          icon={<span className="text-[11px] font-extrabold leading-none">90°</span>}
          onClick={hasSelection ? () => onRotate(selectedFurnitureId) : undefined}
        />
        <EditorToolButton
          label="가구 삭제"
          icon={<FiTrash2 aria-hidden="true" />}
          onClick={hasSelection ? () => onDelete(selectedFurnitureId) : undefined}
        />
        <EditorToolButton label="초기화" icon={<FiRotateCcw aria-hidden="true" />} onClick={onReset} />
      </div>
    </section>
  );
}

function EditorToolButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={!onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e2e2e2] bg-white px-3 py-2 text-xs font-extrabold text-[#222222] transition-colors hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
