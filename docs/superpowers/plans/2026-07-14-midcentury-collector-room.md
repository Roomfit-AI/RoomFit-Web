# Mid-century Collector Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second selectable sample room that renders a bright, procedural modern mid-century collector bedroom without changing the existing sample room.

**Architecture:** The backend will seed a new `RoomSource.SAMPLE` room with stable `collector-*` furniture IDs. The frontend will map those IDs to a small palette/geometry configuration and route only those IDs to a new procedural furniture component; all other furniture keeps the current renderer route.

**Tech Stack:** Spring Boot/JUnit 5, React, TypeScript, React Three Fiber, Drei, Three.js built-in geometries.

## Global Constraints

- Keep the existing sample-room data and public API schema unchanged.
- Use no external models, textures, or image assets.
- Use only built-in Three.js geometries and current material utilities.
- Keep presentation viewers free of TransformControls, selection boxes, axes, and grid helpers.
- Preserve `RoomFit-Backend/gradle.properties` as an untracked local file.

---

### Task 1: Seed and expose the new backend sample

**Files:**
- Modify: `RoomFit-Backend/src/main/java/com/roomfit/room/RoomSampleDataInitializer.java`
- Modify: `RoomFit-Backend/src/test/java/com/roomfit/room/controller/RoomSamplesControllerTest.java`

**Interfaces:**
- Consumes: the existing `Room`, `Furniture`, `Opening`, `Position`, and `RoomRepository` constructors.
- Produces: a second `RoomSource.SAMPLE` entry named `미드센추리 컬렉터 룸` from `GET /api/rooms/samples`.

- [ ] **Step 1: Write the failing API expectation**

  Change the controller test to expect two sample rooms and add:

  ```java
  .andExpect(jsonPath("$.data.length()").value(2))
  .andExpect(jsonPath("$.data[1].name").value("미드센추리 컬렉터 룸"))
  .andExpect(jsonPath("$.data[1].room.width").value(6.4))
  .andExpect(jsonPath("$.data[1].room.depth").value(5.8))
  .andExpect(jsonPath("$.data[1].furniture[?(@.id == 'collector-bed')]").isNotEmpty())
  .andExpect(jsonPath("$.data[1].furniture[?(@.id == 'collector-console')]").isNotEmpty());
  ```

- [ ] **Step 2: Run the controller test and verify it fails**

  Run:

  ```bash
  ./gradlew test --tests com.roomfit.room.controller.RoomSamplesControllerTest
  ```

  Expected: the list-size/name assertions fail before the second seed room exists.

- [ ] **Step 3: Add the collector room seed**

  In `RoomSampleDataInitializer`, retain the existing room creation and add a
  second explicit `Room` with this name, 6.4m × 5.8m × 2.8m dimensions, a
  north-wall 2.4m window, a south-wall entry, and stable IDs for: `collector-bed`,
  `collector-bedside`, `collector-floor-plant`, `collector-desk`,
  `collector-desk-chair`, `collector-blue-cabinet`, `collector-glass-shelf`,
  `collector-console`, `collector-red-shelf`, `collector-lounge-chair`,
  `collector-cane-chair`, `collector-rug`, and `collector-coffee-table`.
  Save it after the existing sample so its ID is 2 in the in-memory repository.

- [ ] **Step 4: Run the test and backend compilation**

  Run:

  ```bash
  ./gradlew test --tests com.roomfit.room.controller.RoomSamplesControllerTest
  ./gradlew compileJava
  ```

  Expected: both commands pass.

- [ ] **Step 5: Commit the backend seed**

  ```bash
  git add src/main/java/com/roomfit/room/RoomSampleDataInitializer.java src/test/java/com/roomfit/room/controller/RoomSamplesControllerTest.java
  git commit -m "feat: add midcentury collector sample room"
  ```

### Task 2: Map collector IDs to the required existing furniture schema

**Files:**
- Modify: `RoomFit-Web/src/api/rooms.ts`

**Interfaces:**
- Consumes: `SampleRoomApiItem`, `Furniture`, and the `collector-*` IDs from Task 1.
- Produces: `toFurniture()` output with a collector-specific palette, material,
  geometry, and normalized floor footprint while preserving the existing API type.

- [ ] **Step 1: Add a collector appearance lookup**

  Add a `collectorAppearanceById` record keyed by the stable IDs. Each entry
  contains the existing `Furniture` fields `color`, `material.type`, and optional
  `geometry`. Use coral for the bedside/lounging furniture, cobalt for the
  modular cabinet, cream for the console/rug, warm wood for bed/desk/chair, and
  glass-like material configuration for the display shelf and coffee table.

- [ ] **Step 2: Apply the lookup in `toFurniture()`**

  Resolve `const collectorAppearance = collectorAppearanceById[item.id]` before
  returning the `Furniture`; use its values when present and retain the existing
  category-derived values otherwise. Do not add fields to `SampleRoomApiItem` or
  `Furniture`.

- [ ] **Step 3: Verify the web type build**

  Run:

  ```bash
  npx vite build
  ```

  Expected: the production bundle succeeds without TypeScript errors.

- [ ] **Step 4: Commit the mapping**

  ```bash
  git add src/api/rooms.ts
  git commit -m "feat: map collector sample furniture appearance"
  ```

### Task 3: Render collector-only procedural furniture

**Files:**
- Create: `RoomFit-Web/src/components/furniture/MidCenturyCollectorFurniture.tsx`
- Modify: `RoomFit-Web/src/components/furniture/FurnitureRenderer.tsx`

**Interfaces:**
- Consumes: one existing `Furniture` object whose ID starts with `collector-`.
- Produces: `MidCenturyCollectorFurniture({ item })`, a grouped procedural mesh
  composition; returns `null` for unrecognized IDs.

- [ ] **Step 1: Build the failing route condition**

  In `FurnitureRenderer`, place the collector route before generic category
  routing:

  ```tsx
  if (item.id.startsWith("collector-")) {
    return <MidCenturyCollectorFurniture item={item} />;
  }
  ```

  Import the component. The initial build should fail until the new module is
  added.

- [ ] **Step 2: Implement focused geometry variants**

  In the new component, switch on `item.id` and render these grouped variants:

  - bed: walnut frame, ivory mattress/duvet, coral cushion, and a thin striped throw;
  - desk/desk-chair: wood desk with slim legs, laptop slab, black desk lamp, and
    a warm-wood chair facing the desk;
  - blue cabinet and glass shelf: cobalt box modules, chrome rails, transparent
    shelf panels, and a restrained set of books/collectibles;
  - console/red shelf: cream low console, thin legs, turntable record, red
    display shelves, small books, plants, and a framed abstract poster;
  - lounge/cane chairs, cream rug, and glass coffee table: a clear lounge group
    with a coral rounded chair facing the table and chrome/glass accents.

  Use `boxGeometry`, `cylinderGeometry`, `sphereGeometry`, `torusGeometry`, and
  transparent `meshStandardMaterial`; use `castShadow`/`receiveShadow` on the
  primary furniture meshes. Do not load assets.

- [ ] **Step 3: Build and inspect the result**

  Run:

  ```bash
  npx vite build
  ```

  Then run the existing web app, select `미드센추리 컬렉터 룸` from `/rooms`, and
  confirm the bed, work/display, console, and lounge zones stay inside the room.

- [ ] **Step 4: Commit the procedural renderer**

  ```bash
  git add src/components/furniture/MidCenturyCollectorFurniture.tsx src/components/furniture/FurnitureRenderer.tsx
  git commit -m "feat: render midcentury collector furniture"
  ```

### Task 4: Verify integration and capture readiness

**Files:**
- Verify only: `RoomFit-Web/src/components/room/RoomViewer.tsx`
- Verify only: `RoomFit-Web/src/components/room/FurnitureMesh.tsx`

**Interfaces:**
- Consumes: the existing `showEditingHelpers` presentation flag.
- Produces: a capture view with no transform gizmo or selection overlay.

- [ ] **Step 1: Verify helper behavior**

  Confirm `RoomViewer` defaults `showEditingHelpers` to `false` and passes that
  value to both transform and selection-indicator rendering. Keep
  `ManageFurniture` as the only caller that enables it.

- [ ] **Step 2: Run final checks**

  Run:

  ```bash
  npx vite build
  git diff --check
  ```

  Expected: both commands pass; default `/editor` does not show a gizmo after a
  furniture click.

- [ ] **Step 3: Commit only if a helper correction was necessary**

  ```bash
  git add src/components/room/RoomViewer.tsx src/components/room/FurnitureMesh.tsx
  git commit -m "fix: keep collector capture view helper-free"
  ```
