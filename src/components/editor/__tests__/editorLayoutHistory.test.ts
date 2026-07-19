import { describe, expect, it } from "vitest";

import {
  canUndoEditorLayout,
  createEditorLayoutHistory,
  reduceEditorLayoutHistory,
} from "../editorLayoutHistory";
import type { Furniture, RoomLayout } from "../../../types";

describe("editorLayoutHistory", () => {
  it("restores the selected furniture rotation with one undo", () => {
    const initial = room([furniture("desk-1")]);
    const edited = reduceEditorLayoutHistory(createEditorLayoutHistory(initial, "room-1:client-a"), {
      type: "edit",
      scopeKey: "room-1:client-a",
      update: (current) => updateFurniture(current, "desk-1", { rotationY: Math.PI / 2 }),
    });

    expect(edited.roomLayout?.furniture[0].rotationY).toBe(Math.PI / 2);
    expect(canUndoEditorLayout(edited, "room-1:client-a")).toBe(true);

    const undone = reduceEditorLayoutHistory(edited, { type: "undo", scopeKey: "room-1:client-a" });

    expect(undone.roomLayout).toEqual(initial);
    expect(canUndoEditorLayout(undone, "room-1:client-a")).toBe(false);
    expect(reduceEditorLayoutHistory(undone, { type: "undo", scopeKey: "room-1:client-a" })).toBe(undone);
  });

  it("restores a deleted furniture item with its previous position and status", () => {
    const initial = room([furniture("desk-1", { position: { x: 1.2, z: -0.4 } })]);
    const edited = reduceEditorLayoutHistory(createEditorLayoutHistory(initial, "room-1:client-a"), {
      type: "edit",
      scopeKey: "room-1:client-a",
      update: (current) => updateFurniture(current, "desk-1", { status: "deleted" }),
    });

    expect(edited.roomLayout?.furniture[0].status).toBe("deleted");

    const undone = reduceEditorLayoutHistory(edited, { type: "undo", scopeKey: "room-1:client-a" });

    expect(undone.roomLayout?.furniture[0]).toEqual(initial.furniture[0]);
  });

  it("undoes only the most recent edit when a different furniture is selected next", () => {
    const initial = room([furniture("desk-1"), furniture("chair-1")]);
    const afterDeskRotation = reduceEditorLayoutHistory(createEditorLayoutHistory(initial, "room-1:client-a"), {
      type: "edit",
      scopeKey: "room-1:client-a",
      update: (current) => updateFurniture(current, "desk-1", { rotationY: Math.PI / 2 }),
    });
    const afterChairDeletion = reduceEditorLayoutHistory(afterDeskRotation, {
      type: "edit",
      scopeKey: "room-1:client-a",
      update: (current) => updateFurniture(current, "chair-1", { status: "deleted" }),
    });

    const undone = reduceEditorLayoutHistory(afterChairDeletion, { type: "undo", scopeKey: "room-1:client-a" });

    expect(undone.roomLayout?.furniture[0].rotationY).toBe(Math.PI / 2);
    expect(undone.roomLayout?.furniture[1].status).toBe("recommended");
  });

  it("keeps the pre-drag snapshot across repeated move updates", () => {
    const initial = room([furniture("desk-1")]);
    const started = reduceEditorLayoutHistory(createEditorLayoutHistory(initial, "room-1:client-a"), {
      type: "beginEdit",
      scopeKey: "room-1:client-a",
    });
    const movedOnce = reduceEditorLayoutHistory(started, {
      type: "updateEdit",
      scopeKey: "room-1:client-a",
      update: (current) => updateFurniture(current, "desk-1", { position: { x: 0.5, z: 0 } }),
    });
    const movedAgain = reduceEditorLayoutHistory(movedOnce, {
      type: "updateEdit",
      scopeKey: "room-1:client-a",
      update: (current) => updateFurniture(current, "desk-1", { position: { x: 1, z: 0.5 } }),
    });
    const ended = reduceEditorLayoutHistory(movedAgain, { type: "endEdit", scopeKey: "room-1:client-a" });

    const undone = reduceEditorLayoutHistory(ended, { type: "undo", scopeKey: "room-1:client-a" });

    expect(undone.roomLayout).toEqual(initial);
  });

  it("does not restore a snapshot for another room or client scope", () => {
    const initial = room([furniture("desk-1")]);
    const edited = reduceEditorLayoutHistory(createEditorLayoutHistory(initial, "room-1:client-a"), {
      type: "edit",
      scopeKey: "room-1:client-a",
      update: (current) => updateFurniture(current, "desk-1", { rotationY: Math.PI / 2 }),
    });

    expect(canUndoEditorLayout(edited, "room-1:client-b")).toBe(false);
    expect(reduceEditorLayoutHistory(edited, { type: "undo", scopeKey: "room-1:client-b" })).toBe(edited);

    const replaced = reduceEditorLayoutHistory(edited, {
      type: "replace",
      scopeKey: "room-2:client-b",
      roomLayout: { ...initial, id: "room-2" },
    });
    expect(canUndoEditorLayout(replaced, "room-2:client-b")).toBe(false);
  });

  it("clears undo when a workflow response replaces the current layout", () => {
    const initial = room([furniture("desk-1")]);
    const edited = reduceEditorLayoutHistory(createEditorLayoutHistory(initial, "room-1:client-a"), {
      type: "edit",
      scopeKey: "room-1:client-a",
      update: (current) => updateFurniture(current, "desk-1", { rotationY: Math.PI / 2 }),
    });
    const workflowLayout = updateFurniture(edited.roomLayout!, "desk-1", { position: { x: 1, z: 1 } });

    const replaced = reduceEditorLayoutHistory(edited, {
      type: "replace",
      scopeKey: "room-1:client-a",
      roomLayout: workflowLayout,
    });

    expect(replaced.roomLayout).toBe(workflowLayout);
    expect(canUndoEditorLayout(replaced, "room-1:client-a")).toBe(false);
  });
});

function room(items: Furniture[]): RoomLayout {
  return {
    id: "room-1",
    name: "테스트 방",
    width: 4,
    depth: 4,
    walls: [],
    doors: [],
    windows: [],
    furniture: items,
  };
}

function furniture(id: string, overrides: Partial<Furniture> = {}): Furniture {
  return {
    id,
    name: id,
    category: "desk",
    dimensions: { width: 1, depth: 0.6, height: 0.75 },
    position: { x: 0, z: 0 },
    rotationY: 0,
    color: "#ffffff",
    material: "wood",
    status: "recommended",
    removable: true,
    ...overrides,
  };
}

function updateFurniture(
  layout: RoomLayout,
  id: string,
  updates: Partial<Furniture>,
): RoomLayout {
  return {
    ...layout,
    furniture: layout.furniture.map((item) => item.id === id ? { ...item, ...updates } : item),
  };
}
