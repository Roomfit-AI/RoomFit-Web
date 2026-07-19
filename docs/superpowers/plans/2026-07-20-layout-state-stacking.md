# Layout State Persistence and Furniture Stacking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist manage-furniture deletions and poses before recommendation/re-entry, while rendering strict monitor-on-desk and TV-on-media-console stacks that break when independently moved.

**Architecture:** Preserve Backend canonical source type separately from broad render category, add a typed client for the existing Room replacement endpoint, and route initial setup snapshots to Room while keeping re-edit snapshots on Layout Draft. Compute stack y positions with a pure resolver consumed by RoomViewer; never mutate furniture x/z or identity.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Axios, React Three Fiber

## Global Constraints

- Use `PUT /api/rooms/{roomId}/layout` only before a Layout exists; use existing `PUT /api/layouts/{layoutId}` for an active unconfirmed Draft.
- Preserve the complete furniture array, IDs, source types, dimensions, center-to-corner x/z conversion, rotation conversion, and all four statuses.
- Preserve local state on persistence failure and prevent next-step recommendation from using a stale Backend baseline.
- Stack only `desk -> monitor` and `media_console -> tv`.
- A visual stack requires center x/z equality within `1.0e-6` and complete containment of the dependent rotated footprint in the supporter rotated footprint.
- Moving either dependent beyond epsilon or deleting its supporter returns the dependent to `height / 2` floor placement.
- Furniture remains independently selectable and draggable; do not parent one Three.js object under another.
- Preserve window-blind `layoutPosition`, TransformControls, catalog variants, legacy furniture, and current coordinate conventions.

---

### Task 1: Web Room persistence and strict stack rendering

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api/rooms.ts`
- Modify: `src/api/__tests__/rooms.test.ts`
- Modify: `src/config/layoutEditingWorkflow.ts`
- Modify: `src/config/__tests__/layoutEditingWorkflow.test.ts`
- Modify: `src/pages/ManageFurniture.tsx`
- Create: `src/components/room/furnitureSupportPlacement.ts`
- Create: `src/components/room/__tests__/furnitureSupportPlacement.test.ts`
- Modify: `src/components/room/RoomViewer.tsx`
- Modify: `src/components/room/__tests__/RoomViewer.test.ts`

**Interfaces:**
- Consumes: `toRoomUploadRequest` coordinate conventions, `toFurniturePositionRequest`, `calculateRotatedFootprint`, `resolveFurnitureLocalFootprint`, active layout session helpers.
- Produces: `Furniture.sourceType?: string`; `replaceRoomFurniture(roomId, room): Promise<RoomLayout>`; `persistManagedFurnitureSnapshot(room, ...): Promise<RoomLayout | null>`; `flushManagedFurniturePersistence(): Promise<void>`; `resolveFurnitureSupportPositions(items): Map<string, Vector3Tuple>`.

- [ ] **Step 1: Write failing API/source-type tests**

Extend `rooms.test.ts` with:

```ts
it("preserves Backend canonical source type separately from render category", () => {
  const result = applyBackendFurnitureToLayout(baseLayout, [
    createBackendFurniture({ type: "MEDIA_CONSOLE" }),
  ]);
  expect(result.furniture[0]).toMatchObject({ category: "cabinet", sourceType: "media_console" });
});

it("replaces the complete Room furniture snapshot without losing DELETED", async () => {
  const room = roomWithFurniture([
    furniture({ id: "console-1", sourceType: "media_console", status: "existing" }),
    furniture({ id: "tv-1", sourceType: "tv", status: "deleted" }),
  ]);
  await replaceRoomFurniture(12, room);
  expect(apiClient.put).toHaveBeenCalledWith("/api/rooms/12/layout", {
    furniture: expect.arrayContaining([
      expect.objectContaining({ id: "console-1", type: "media_console", status: "EXISTING" }),
      expect.objectContaining({ id: "tv-1", type: "tv", status: "DELETED" }),
    ]),
  });
});
```

Also assert x/z adds half room dimensions and `rotationY` converts to normalized negative degrees.

- [ ] **Step 2: Run API tests and verify RED**

Run:

```bash
npm run test:run -- src/api/__tests__/rooms.test.ts
```

Expected: FAIL because `sourceType` and `replaceRoomFurniture` do not exist.

- [ ] **Step 3: Implement source-type preservation and Room replacement API**

Add `sourceType?: string` to `Furniture`. In the Backend mapper set it only when normalization succeeds:

```ts
const canonicalType = normalizeCanonicalFurnitureType(normalizedItem.type);
const furniture: Furniture = {
  // existing fields
  ...(canonicalType ? { sourceType: canonicalType } : {}),
};
```

Create a replacement request serializer that reuses the upload pose conversion but does not collapse status or source type:

```ts
function toFurnitureStatusApiValue(status: FurnitureStatus) {
  return { existing: "EXISTING", recommended: "RECOMMENDED",
    user_modified: "USER_MODIFIED", deleted: "DELETED" }[status];
}

export function toRoomFurnitureReplaceRequest(room: RoomLayout) {
  return { furniture: room.furniture.map((item) => ({
    id: item.id,
    type: item.sourceType ?? item.category,
    label: item.name,
    width: item.dimensions.width,
    depth: item.dimensions.depth,
    height: item.dimensions.height,
    position: { x: item.position.x + room.width / 2, z: item.position.z + room.depth / 2 },
    rotation: normalizeDegrees((-item.rotationY * 180) / Math.PI),
    status: toFurnitureStatusApiValue(item.status),
  })) };
}

export async function replaceRoomFurniture(roomId: number, room: RoomLayout): Promise<RoomLayout> {
  const response = await apiClient.put<ApiResponse<SampleRoomApiItem>>(
    `/api/rooms/${roomId}/layout`, toRoomFurnitureReplaceRequest(room));
  return toUploadedRoomCard(response.data.data, 0).layout;
}
```

- [ ] **Step 4: Run API tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Write failing workflow persistence tests**

Extend the workflow fake API with `replaceRoomFurniture`. Add tests with these exact outcomes:

```ts
it("persists initial manage-furniture deletion before next navigation", async () => {
  const room = createRoom(); room.furniture[1].status = "deleted";
  const storage = selectedRoomStorage(room);
  const api = fakeApi({ latest: null, replacedRoom: room });
  const state = await prepareManagedFurnitureDraft(storage, api);
  expect(api.replaceRoomFurniture).toHaveBeenCalledWith(1, room);
  expect(state?.roomLayout?.furniture[1].status).toBe("deleted");
});

it("reloads a persisted initial deletion from Backend Room", async () => {
  const backend = createRoom(); backend.furniture[1].status = "deleted";
  const restored = await loadManagedFurnitureLayout(createRoom(), 1, storage, fakeApi({ room: backend }));
  expect(restored?.furniture[1].status).toBe("deleted");
});

it("uses Layout Draft persistence instead of Room replacement during re-edit", async () => {
  saveDraftSession(storage, 31, 10);
  await persistManagedFurnitureSnapshot(room, storage, api);
  expect(api.updateLayout).toHaveBeenCalledWith(31, room);
  expect(api.replaceRoomFurniture).not.toHaveBeenCalled();
});
```

Add a rejection case proving localStorage remains the edited JSON and `prepareManagedFurnitureDraft` rejects rather than navigating with stale state.

- [ ] **Step 6: Run workflow tests and verify RED**

Run:

```bash
npm run test:run -- src/config/__tests__/layoutEditingWorkflow.test.ts
```

Expected: FAIL because the Room persistence interface and queue do not exist.

- [ ] **Step 7: Implement serialized manage-furniture persistence and page integration**

Extend `LayoutWorkflowApi` and `defaultApi` with `replaceRoomFurniture`. Add a serialized queue following the existing editor persistence pattern:

```ts
let pendingManagedFurniturePersistence: Promise<void> = Promise.resolve();
let latestManagedFurniturePersistence: Promise<unknown> = Promise.resolve();

export function persistManagedFurnitureSnapshot(room: RoomLayout, storage = localStorage,
  api: LayoutWorkflowApi = defaultApi): Promise<RoomLayout | null> {
  const task = pendingManagedFurniturePersistence.then(async () => {
    const backendRoomId = parseBackendRoomId(storage.getItem("roomfit:backendRoomId"));
    if (backendRoomId === null) return null;
    const session = readActiveLayoutEditingSession(storage);
    const saved = isSessionForRoom(session, room.id, backendRoomId) && !session.confirmed
      ? applyBackendFurnitureToLayout(room, (await api.updateLayout(session.activeLayoutId, room)).recommendedFurniture)
      : await api.replaceRoomFurniture(backendRoomId, room);
    persistActiveDraftMirror(saved, storage);
    return saved;
  });
  pendingManagedFurniturePersistence = task.then(() => undefined, () => undefined);
  latestManagedFurniturePersistence = task;
  return task;
}

export async function flushManagedFurniturePersistence() {
  await latestManagedFurniturePersistence;
}
```

`prepareManagedFurnitureDraft` must flush any pending task, then save the current initial Room through `replaceRoomFurniture` before returning INITIAL_SETUP navigation state. It must keep the current Draft branch unchanged for re-edit.

In `ManageFurniture`, keep a ref to the latest Room snapshot and call `persistManagedFurnitureSnapshot` after delete, reset, rotate, and drag end. Persist localStorage synchronously first, keep the edited UI on rejection, and set `layoutError`. Pass `onEndMoveFurniture` to RoomViewer so drag updates are saved once at drag end instead of on every TransformControls tick.

- [ ] **Step 8: Run workflow and page tests**

Run:

```bash
npm run test:run -- src/config/__tests__/layoutEditingWorkflow.test.ts src/pages/__tests__/ManageFurniture.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Write failing strict visual support tests**

Create pure resolver tests for centered monitor/desk, centered TV/console, reversed list order, wrong type, oversized dependent, `0.01m` independent move, and deleted supporter. Assertions:

```ts
expect(resolveFurnitureSupportPositions([desk, monitor]).get("monitor")?.[1])
  .toBe(desk.dimensions.height + monitor.dimensions.height / 2);
expect(resolveFurnitureSupportPositions([desk, { ...monitor, position: { x: 0.01, z: 0 } }])
  .get("monitor")?.[1]).toBe(monitor.dimensions.height / 2);
```

- [ ] **Step 10: Run support tests and verify RED**

Run:

```bash
npm run test:run -- src/components/room/__tests__/furnitureSupportPlacement.test.ts
```

Expected: FAIL because the resolver does not exist.

- [ ] **Step 11: Implement pure strict support resolver and integrate RoomViewer**

Use `normalizeCanonicalFurnitureType(item.sourceType)`, `resolveFurnitureLocalFootprint`, and `calculateRotatedFootprint`. Match supporter/dependent by the two allowed pairs, active status, epsilon centers, and dependent min/max containment inside supporter min/max. Return every visible furniture ID with `[item.position.x, y, item.position.z]`, where y is floor by default and supporter-top only for a strict pair.

In RoomViewer compute once per render:

```tsx
const supportPositions = resolveFurnitureSupportPositions(visibleFurniture);
// inside map
const supportPosition = supportPositions.get(item.id);
<FurnitureMesh layoutPosition={blindPlacement?.position ?? supportPosition} ... />
```

Blind placement remains higher priority than support placement. Do not change `FurnitureMesh` transform or parenting.

- [ ] **Step 12: Run support and RoomViewer tests**

Run:

```bash
npm run test:run -- src/components/room/__tests__/furnitureSupportPlacement.test.ts src/components/room/__tests__/RoomViewer.test.ts
```

Expected: PASS.

- [ ] **Step 13: Run Web full verification**

Run:

```bash
npm run test:run
npm run lint
npm run build
```

Expected: all Vitest files pass, ESLint exits 0, TypeScript/Vite build exits 0.

- [ ] **Step 14: Commit Web implementation**

```bash
git add src/types.ts src/api/rooms.ts src/api/__tests__/rooms.test.ts \
  src/config/layoutEditingWorkflow.ts src/config/__tests__/layoutEditingWorkflow.test.ts \
  src/pages/ManageFurniture.tsx src/components/room/furnitureSupportPlacement.ts \
  src/components/room/__tests__/furnitureSupportPlacement.test.ts \
  src/components/room/RoomViewer.tsx src/components/room/__tests__/RoomViewer.test.ts
git commit -m "fix: persist furniture state and render support stacks"
```
