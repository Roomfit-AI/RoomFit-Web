// Shared between AddFurniture.tsx's catalog grid and LayoutConfirm.tsx's
// shopping-list thumbnails. The CSS visuals themselves (.furniture-card-*,
// see index.css) are hand-drawn at a fixed 110x82px, so a smaller use site
// (a compact list thumbnail vs. a full catalog card) scales that same
// artwork down via `scale` instead of needing a second, separately
// hand-tuned set of dimensions per visual.
export default function FurnitureVisual({
  type,
  className = "h-36",
  scale = 1,
}: {
  type: string;
  className?: string;
  scale?: number;
}) {
  return (
    <div className={`relative grid place-items-center overflow-hidden rounded-lg bg-[#f3f0eb] ${className}`}>
      <div
        className={`furniture-card-visual furniture-card-${type}`}
        style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
      >
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
