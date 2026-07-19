import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Furniture } from "../../types";
import { FurnitureRow, FurnitureStatusPanel } from "../ManageFurniture";

describe("FurnitureStatusPanel", () => {
  it("removes the non-functional more button while preserving the title and furniture list", () => {
    const markup = renderToStaticMarkup(
      <FurnitureStatusPanel items={[desk]} selectedFurnitureId={null} onSelect={() => undefined} onRemove={() => undefined} />,
    );
    expect(markup).toContain("가구 현황");
    expect(markup).toContain("기존 책상");
    expect(markup).not.toContain('aria-label="더보기"');
  });

  it("keeps the existing furniture delete handler", () => {
    const onRemove = vi.fn();
    const element = FurnitureRow({ item: desk, selected: false, onSelect: vi.fn(), onRemove: () => onRemove(desk.id) });
    findButton(element, "기존 책상 삭제")?.props.onClick?.();
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("desk-1");
  });
});

const desk: Furniture = {
  id: "desk-1",
  name: "기존 책상",
  category: "desk",
  dimensions: { width: 1, depth: 0.6, height: 0.7 },
  position: { x: 0, z: 0 },
  rotationY: 0,
  color: "#fff",
  material: "wood",
  status: "existing",
  removable: true,
};

function findButton(node: ReactNode, ariaLabel: string): React.ReactElement<{
  "aria-label"?: string;
  onClick?: () => void;
  children?: ReactNode;
}> | null {
  if (Array.isArray(node)) return node.map((child) => findButton(child, ariaLabel)).find(Boolean) ?? null;
  if (!isValidElement<{ "aria-label"?: string; onClick?: () => void; children?: ReactNode }>(node)) return null;
  if (node.type === "button" && node.props["aria-label"] === ariaLabel) return node;
  return findButton(node.props.children, ariaLabel);
}
