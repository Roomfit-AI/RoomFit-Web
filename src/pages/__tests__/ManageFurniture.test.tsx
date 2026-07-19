import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Furniture } from "../../types";
import { settleLatestManagedFurniturePersistence } from "../../config/layoutEditingWorkflow";
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

describe("manage-furniture persistence feedback", () => {
  it("ignores an older failure and lets the latest success clear the error", async () => {
    const older = deferred<void>();
    const latest = deferred<void>();
    const revisionRef = { current: 0 };
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    settleLatestManagedFurniturePersistence(older.promise, revisionRef, onSuccess, onFailure);
    settleLatestManagedFurniturePersistence(latest.promise, revisionRef, onSuccess, onFailure);
    older.reject(new Error("old failure"));
    await Promise.resolve();
    expect(onFailure).not.toHaveBeenCalled();

    latest.resolve();
    await Promise.resolve();
    expect(onSuccess).toHaveBeenCalledTimes(1);
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
