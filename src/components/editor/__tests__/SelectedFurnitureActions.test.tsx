import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SelectedFurnitureActions from "../SelectedFurnitureActions";

describe("SelectedFurnitureActions", () => {
  it("renders one rotate, delete, and undo control for the selected furniture", () => {
    const element = SelectedFurnitureActions(createProps("desk-1"));
    const markup = renderToStaticMarkup(element);
    const visibleText = markup.replace(/<[^>]*>/g, "");

    expect(markup).toContain("책상");
    expect(markup).toContain('aria-label="90° 회전"');
    expect(markup).not.toContain('aria-label="90° 90° 회전"');
    expect(markup).toContain('aria-label="가구 삭제"');
    expect(markup).toContain('aria-label="이전"');
    expect(visibleText.match(/90°/g)).toHaveLength(1);
    expect(visibleText.match(/90° 회전/g)).toHaveLength(1);
    expect(findControls(element, "90° 회전")).toHaveLength(1);
    expect(findControls(element, "가구 삭제")).toHaveLength(1);
    expect(findControls(element, "이전")).toHaveLength(1);
  });

  it("keeps rotate, delete, and undo disabled when unavailable", () => {
    const element = SelectedFurnitureActions(createProps(null));
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("3D 화면에서 가구를 선택해 주세요");
    expect(findControls(element, "90° 회전")[0]?.props.onClick).toBeUndefined();
    expect(findControls(element, "가구 삭제")[0]?.props.onClick).toBeUndefined();
    expect(findControls(element, "이전")[0]?.props.onClick).toBeUndefined();
    expect((markup.match(/disabled=""/g) ?? [])).toHaveLength(3);
  });

  it("calls rotate, delete, and undo handlers without duplicating controls", () => {
    const onRotate = vi.fn();
    const onDelete = vi.fn();
    const onUndo = vi.fn();
    const element = SelectedFurnitureActions({
      ...createProps("desk-1"),
      onRotate,
      onDelete,
      onUndo,
      canUndo: true,
    });

    findControls(element, "90° 회전")[0]?.props.onClick?.();
    findControls(element, "가구 삭제")[0]?.props.onClick?.();
    findControls(element, "이전")[0]?.props.onClick?.();

    expect(onRotate).toHaveBeenCalledExactlyOnceWith("desk-1");
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("desk-1");
    expect(onUndo).toHaveBeenCalledOnce();
  });
});

function createProps(selectedFurnitureId: string | null) {
  return {
    selectedFurnitureId,
    selectedFurnitureName: selectedFurnitureId ? "책상" : undefined,
    onRotate: vi.fn(),
    onDelete: vi.fn(),
    onUndo: vi.fn(),
    canUndo: false,
  };
}

function findControls(node: ReactNode, label: string): Array<React.ReactElement<{
  label?: string;
  onClick?: () => void;
  children?: ReactNode;
}>> {
  if (Array.isArray(node)) return node.flatMap((child) => findControls(child, label));
  if (!isValidElement<{ label?: string; onClick?: () => void; children?: ReactNode }>(node)) return [];
  const matches = node.props.label === label ? [node] : [];
  return [...matches, ...findControls(node.props.children, label)];
}
