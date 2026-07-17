import { useMemo, useState } from "react";
import { FurnitureVariantPreview } from "./FurnitureVariantPreview";
import type { FurnitureVariantPreviewView } from "./FurnitureVariantPreview";
import {
  PRODUCTION_FURNITURE_VARIANT_IDS,
  createProductionFurnitureCatalog,
} from "./productionFurnitureCatalog";
import type { ProductionFurnitureVariantId } from "./productionFurnitureCatalog";

const VIEW_OPTIONS: ReadonlyArray<{
  id: FurnitureVariantPreviewView;
  label: string;
}> = [
  { id: "front", label: "정면" },
  { id: "side", label: "측면" },
  { id: "top", label: "상단" },
];

export function FurnitureVariantPreviewHarness() {
  const catalog = useMemo(() => createProductionFurnitureCatalog(), []);
  const [variantId, setVariantId] = useState<ProductionFurnitureVariantId>(
    PRODUCTION_FURNITURE_VARIANT_IDS[0],
  );
  const [view, setView] = useState<FurnitureVariantPreviewView>("front");
  const variant = catalog.registry.getFurnitureVariant(variantId);

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Furniture Variant</span>
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value as ProductionFurnitureVariantId)}
          >
            {catalog.variants.map((item) => (
              <option key={item.variantId} value={item.variantId}>
                {item.name} ({item.variantId})
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="Preview view" style={{ display: "flex", gap: 4 }}>
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={view === option.id}
              onClick={() => setView(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 12px" }}>
        <dt>Dimensions</dt>
        <dd style={{ margin: 0 }}>
          {variant.dimensions.width} × {variant.dimensions.depth} × {variant.dimensions.height} m
        </dd>
        <dt>Materials</dt>
        <dd style={{ margin: 0 }}>{variant.materials.join(", ")}</dd>
        <dt>Origin</dt>
        <dd style={{ margin: 0 }}>floor-center, +Z front</dd>
      </dl>

      <FurnitureVariantPreview
        variantId={variantId}
        registry={catalog.registry}
        materialPresets={catalog.materialPresets}
        view={view}
      />
    </main>
  );
}
