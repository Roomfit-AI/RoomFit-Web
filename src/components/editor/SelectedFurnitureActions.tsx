import { FiMinus, FiPlus, FiRefreshCw, FiRotateCw, FiTrash2 } from "react-icons/fi";
import type { Size3D } from "../../types";

const MIN_DIMENSION_METERS = 0.1;
const MAX_DIMENSION_METERS = 5;
const DIMENSION_STEP_METERS = 0.05;

interface SelectedFurnitureActionsProps {
  selectedFurnitureId: string | null;
  selectedFurnitureName?: string;
  selectedFurnitureDimensions?: Pick<Size3D, "width" | "depth">;
  canEditSelection?: boolean;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
  onResize?: (id: string, dimensions: Pick<Size3D, "width" | "depth">) => void;
  canReset: boolean;
}

export default function SelectedFurnitureActions({
  selectedFurnitureId,
  selectedFurnitureName,
  selectedFurnitureDimensions,
  canEditSelection = true,
  onRotate,
  onDelete,
  onReset,
  onResize,
  canReset,
}: SelectedFurnitureActionsProps) {
  const hasSelection = selectedFurnitureId !== null;
  const canEdit = hasSelection && canEditSelection;
  const canResize = canEdit && Boolean(onResize) && Boolean(selectedFurnitureDimensions);

  const adjustDimension = (axis: "width" | "depth", delta: number) => {
    if (!canResize || !selectedFurnitureId || !selectedFurnitureDimensions || !onResize) {
      return;
    }
    const next = clamp(selectedFurnitureDimensions[axis] + delta);
    if (next === selectedFurnitureDimensions[axis]) {
      return;
    }
    onResize(selectedFurnitureId, { ...selectedFurnitureDimensions, [axis]: next });
  };

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
        {onResize && (
          <>
            <DimensionStepper
              label="가로"
              value={selectedFurnitureDimensions?.width}
              disabled={!canResize}
              onDecrease={() => adjustDimension("width", -DIMENSION_STEP_METERS)}
              onIncrease={() => adjustDimension("width", DIMENSION_STEP_METERS)}
            />
            <DimensionStepper
              label="세로"
              value={selectedFurnitureDimensions?.depth}
              disabled={!canResize}
              onDecrease={() => adjustDimension("depth", -DIMENSION_STEP_METERS)}
              onIncrease={() => adjustDimension("depth", DIMENSION_STEP_METERS)}
            />
          </>
        )}
        <EditorToolButton
          label="90° 회전"
          icon={<FiRotateCw aria-hidden="true" />}
          onClick={canEdit ? () => onRotate(selectedFurnitureId) : undefined}
        />
        <EditorToolButton
          label="가구 삭제"
          icon={<FiTrash2 aria-hidden="true" />}
          onClick={canEdit ? () => onDelete(selectedFurnitureId) : undefined}
        />
        <EditorToolButton
          label="초기화"
          icon={<FiRefreshCw aria-hidden="true" />}
          onClick={canReset && hasSelection ? () => onReset(selectedFurnitureId) : undefined}
        />
      </div>
    </section>
  );
}

function DimensionStepper({
  label,
  value,
  disabled,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number | undefined;
  disabled: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex min-h-10 items-center gap-1 rounded-lg border border-[#e2e2e2] bg-white px-2 py-1 text-xs font-extrabold text-[#222222]">
      <span className="text-[#777777]">{label}</span>
      <button
        type="button"
        aria-label={`${label} 줄이기`}
        onClick={onDecrease}
        disabled={disabled}
        className="grid h-6 w-6 place-items-center rounded-md hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FiMinus aria-hidden="true" />
      </button>
      <span className="w-11 text-center tabular-nums">{value !== undefined ? `${value.toFixed(2)}m` : "-"}</span>
      <button
        type="button"
        aria-label={`${label} 늘리기`}
        onClick={onIncrease}
        disabled={disabled}
        className="grid h-6 w-6 place-items-center rounded-md hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FiPlus aria-hidden="true" />
      </button>
    </div>
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

function clamp(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(MAX_DIMENSION_METERS, Math.max(MIN_DIMENSION_METERS, rounded));
}
