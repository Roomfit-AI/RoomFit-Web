import { describe, expect, it } from "vitest";

import {
  canResetEditorFurniture,
  createEditorLayoutScopeKey,
  createEditorLayoutState,
  reduceEditorLayoutState,
} from "../editorLayoutState";
import type { Furniture, RoomLayout } from "../../../types";

describe("editorLayoutState", () => {
  it("resets repeated rotations to the layout baseline", () => {
    const initial = room([furniture("desk-1", { rotationY: Math.PI / 4 })]);
    let state = createEditorLayoutState(initial, "room-1:client-a:layout-31");

    state = edit(state, "desk-1", { rotationY: Math.PI / 2 });
    state = edit(state, "desk-1", { rotationY: Math.PI });
    state = reduceEditorLayoutState(state, {
      type: "resetFurniture",
      scopeKey: "room-1:client-a:layout-31",
      furnitureId: "desk-1",
    });

    expect(state.roomLayout?.furniture[0]).toEqual(initial.furniture[0]);
    expect(state.persistenceRequest?.roomLayout).toBe(state.roomLayout);
  });

  it("resets movement and deletion with all original furniture metadata", () => {
    const initialFurniture = furniture("desk-1", {
      position: { x: 1.2, z: -0.4 },
      rotationY: Math.PI / 4,
      productId: "desk-product",
      variantId: "desk-compact",
      styleTags: ["natural", "compact"],
      theme: "wood",
    });
    let state = createEditorLayoutState(room([initialFurniture]), "room-1:client-a:layout-31");

    state = reduceEditorLayoutState(state, {
      type: "beginEdit",
      scopeKey: state.scopeKey,
    });
    state = reduceEditorLayoutState(state, {
      type: "updateEdit",
      scopeKey: state.scopeKey,
      update: (current) => updateFurniture(current, "desk-1", {
        position: { x: -1, z: 0.75 },
        status: "user_modified",
      }),
    });
    state = reduceEditorLayoutState(state, { type: "endEdit", scopeKey: state.scopeKey });
    state = edit(state, "desk-1", {
      status: "deleted",
      productId: "changed-product",
      variantId: "changed-variant",
    });
    state = reduceEditorLayoutState(state, {
      type: "resetFurniture",
      scopeKey: state.scopeKey,
      furnitureId: "desk-1",
    });

    expect(state.roomLayout?.furniture[0]).toEqual(initialFurniture);
  });

  it("does not change other furniture when one selected furniture is reset", () => {
    const initial = room([furniture("desk-1"), furniture("chair-1")]);
    let state = createEditorLayoutState(initial, "room-1:client-a:layout-31");
    state = edit(state, "desk-1", { rotationY: Math.PI / 2 });
    state = edit(state, "chair-1", { position: { x: 1, z: 1 } });

    const chairBeforeReset = state.roomLayout?.furniture[1];
    state = reduceEditorLayoutState(state, {
      type: "resetFurniture",
      scopeKey: state.scopeKey,
      furnitureId: "desk-1",
    });

    expect(state.roomLayout?.furniture[0]).toEqual(initial.furniture[0]);
    expect(state.roomLayout?.furniture[1]).toBe(chairBeforeReset);
  });

  it("keeps reset repeatable and makes an already-baseline reset a no-op", () => {
    const initial = room([furniture("desk-1")]);
    let state = createEditorLayoutState(initial, "room-1:client-a:layout-31");
    state = edit(state, "desk-1", { rotationY: Math.PI / 2 });
    state = reduceEditorLayoutState(state, {
      type: "resetFurniture",
      scopeKey: state.scopeKey,
      furnitureId: "desk-1",
    });
    const onceReset = state;
    state = reduceEditorLayoutState(state, {
      type: "resetFurniture",
      scopeKey: state.scopeKey,
      furnitureId: "desk-1",
    });
    expect(state).toBe(onceReset);

    state = edit(state, "desk-1", { rotationY: Math.PI });
    state = reduceEditorLayoutState(state, {
      type: "resetFurniture",
      scopeKey: state.scopeKey,
      furnitureId: "desk-1",
    });
    expect(state.roomLayout?.furniture[0]).toEqual(initial.furniture[0]);
  });

  it("persists one completed drag but not a drag without movement", () => {
    const initial = room([furniture("desk-1")]);
    const started = reduceEditorLayoutState(
      createEditorLayoutState(initial, "room-1:client-a:layout-31"),
      { type: "beginEdit", scopeKey: "room-1:client-a:layout-31" },
    );
    const noMovement = reduceEditorLayoutState(started, {
      type: "endEdit",
      scopeKey: started.scopeKey,
    });
    expect(noMovement.persistenceRequest).toBeNull();

    const moved = reduceEditorLayoutState(started, {
      type: "updateEdit",
      scopeKey: started.scopeKey,
      update: (current) => updateFurniture(current, "desk-1", { position: { x: 1, z: 1 } }),
    });
    expect(moved.persistenceRequest).toBeNull();
    const ended = reduceEditorLayoutState(moved, { type: "endEdit", scopeKey: moved.scopeKey });
    expect(ended.persistenceRequest?.roomLayout).toBe(ended.roomLayout);
  });

  it("tracks persistence by request ID so an older completion cannot unlock a newer save", () => {
    const initial = room([furniture("desk-1")]);
    let state = edit(
      createEditorLayoutState(initial, "room-1:client-a:layout-31"),
      "desk-1",
      { rotationY: Math.PI / 2 },
    );
    const firstRequestId = state.persistenceRequest!.requestId;
    expect(state.persistenceRequest!.scopeKey).toBe("room-1:client-a:layout-31");
    expect(state.isPersisting).toBe(true);

    state = edit(state, "desk-1", { rotationY: Math.PI });
    const secondRequestId = state.persistenceRequest!.requestId;
    state = reduceEditorLayoutState(state, {
      type: "finishPersistence",
      scopeKey: state.scopeKey,
      requestId: firstRequestId,
    });
    expect(state.isPersisting).toBe(true);

    state = reduceEditorLayoutState(state, {
      type: "finishPersistence",
      scopeKey: state.scopeKey,
      requestId: secondRequestId,
    });
    expect(state.isPersisting).toBe(false);
  });

  it("rejects reset across room, client, or active layout scopes", () => {
    const initial = room([furniture("desk-1")]);
    const edited = edit(
      createEditorLayoutState(initial, "room-1:client-a:layout-31"),
      "desk-1",
      { rotationY: Math.PI / 2 },
    );

    for (const wrongScope of [
      "room-2:client-a:layout-31",
      "room-1:client-b:layout-31",
      "room-1:client-a:layout-32",
    ]) {
      expect(canResetEditorFurniture(edited, wrongScope, "desk-1")).toBe(false);
      expect(reduceEditorLayoutState(edited, {
        type: "resetFurniture",
        scopeKey: wrongScope,
        furnitureId: "desk-1",
      })).toBe(edited);
    }
  });

  it("builds distinct scope keys for room, client, and active layout ownership", () => {
    const owner = {
      roomLayoutId: "room-1",
      backendRoomId: 10,
      activeLayoutId: 31,
      clientMode: "APP_UUID",
      clientId: "client-a",
      setupSessionId: "setup-a",
      scopedRoomLayoutId: "room-1",
      scopedBackendRoomId: 10,
    };
    const current = createEditorLayoutScopeKey(owner);

    expect(createEditorLayoutScopeKey({ ...owner, roomLayoutId: "room-2" })).not.toBe(current);
    expect(createEditorLayoutScopeKey({ ...owner, clientId: "client-b" })).not.toBe(current);
    expect(createEditorLayoutScopeKey({ ...owner, activeLayoutId: 32 })).not.toBe(current);
  });

  it("replaces the baseline for a new recommendation or successful feedback layout", () => {
    const initial = room([furniture("desk-1")]);
    const edited = edit(
      createEditorLayoutState(initial, "room-1:client-a:layout-31"),
      "desk-1",
      { rotationY: Math.PI / 2 },
    );
    const workflowLayout = updateFurniture(initial, "desk-1", {
      position: { x: 1, z: 1 },
      rotationY: Math.PI / 4,
    });
    let replaced = reduceEditorLayoutState(edited, {
      type: "replace",
      scopeKey: "room-1:client-a:layout-32",
      roomLayout: workflowLayout,
    });
    replaced = edit(replaced, "desk-1", { rotationY: Math.PI });
    replaced = reduceEditorLayoutState(replaced, {
      type: "resetFurniture",
      scopeKey: replaced.scopeKey,
      furnitureId: "desk-1",
    });

    expect(replaced.roomLayout?.furniture[0]).toEqual(workflowLayout.furniture[0]);
  });

  it("requires a selected furniture that exists in both current and baseline layouts", () => {
    const state = createEditorLayoutState(room([furniture("desk-1")]), "room-1:client-a:layout-31");

    expect(canResetEditorFurniture(state, state.scopeKey, null)).toBe(false);
    expect(canResetEditorFurniture(state, state.scopeKey, "chair-1")).toBe(false);
    expect(canResetEditorFurniture(state, state.scopeKey, "desk-1")).toBe(true);
  });

  it("resets only the private current layout without mutating a PUBLIC Sample source", () => {
    const publicSample = { ...room([furniture("desk-1")]), id: "public-room", source: "PUBLIC" };
    const privateCopy = {
      ...publicSample,
      id: "private-copy",
      source: "SAMPLE_COPY",
      furniture: publicSample.furniture.map((item) => ({ ...item })),
    };
    let state = createEditorLayoutState(privateCopy, "private-copy:client-a:layout-31");
    state = edit(state, "desk-1", { status: "deleted" });
    state = reduceEditorLayoutState(state, {
      type: "resetFurniture",
      scopeKey: state.scopeKey,
      furnitureId: "desk-1",
    });

    expect(state.roomLayout).toEqual(privateCopy);
    expect(publicSample.furniture[0].status).toBe("recommended");
    expect(publicSample).not.toBe(state.roomLayout);
  });
});

function edit(
  state: ReturnType<typeof createEditorLayoutState>,
  id: string,
  updates: Partial<Furniture>,
) {
  return reduceEditorLayoutState(state, {
    type: "edit",
    scopeKey: state.scopeKey,
    update: (current) => updateFurniture(current, id, updates),
  });
}

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
