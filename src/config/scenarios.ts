import type { Furniture, Opening, RoomLayout } from "../types";

// Two fixed demo moods, triggered from the "AI 추천 생성" button in
// /editor (see EditorPlaceholder.tsx) instead of the real backend call for
// rooms whose saved purpose/style match one of these — real per-mood
// recommendation isn't implemented anywhere in this app, so this is a
// scripted stand-in scoped to exactly the two moods the demo needs.
//
// Each scenario can remove pieces that don't fit the mood (a desk chair in a
// "rest" room), restyle whatever survives (color/material, and — for pieces
// with a `theme`-aware design like Bed.tsx — proportions too), and add new
// mood-appropriate pieces (a rug, a floor lamp, a bookshelf).
export interface Scenario {
  id: string;
  purpose: string;
  style: string;
  palette: string;
  // Stable ids for this scenario's *added* furniture, checked against the
  // room's existing furniture before applying so re-clicking "AI 추천 생성"
  // never appends duplicates. Restyling/removal are idempotent (recoloring
  // an already-gray desk gray again, or removing an already-removed desk, is
  // a no-op) so they don't need the same guard.
  itemIds: string[];
  // Which /add-furniture catalog items best match this mood, for a
  // consistent manage-furniture -> preference -> add-furniture -> editor
  // demo walkthrough.
  addFurnitureIds: string[];
  // True for pieces that don't belong in this mood at all (a desk in a rest
  // room) — dropped entirely rather than restyled.
  remove: (item: Furniture) => boolean;
  restyle: (item: Furniture) => Furniture;
  build: (room: RoomLayout) => Furniture[];
  // Optional per-window restyle (e.g. blind -> curtain, see Curtain.tsx).
  // Undefined means "leave windows exactly as saved" — the default
  // wood-blind rendering in Blind.tsx is never touched by a scenario that
  // doesn't set this.
  restyleWindow?: (opening: Opening) => Opening;
}

function withColor(item: Furniture, color: string, materialType: "fabric" | "wood" | "white" | "metal" | "glass" | "accent", theme: Furniture["theme"]): Furniture {
  return {
    ...item,
    color,
    material: { type: materialType, color, roughness: 0.6, metalness: 0 },
    theme,
  };
}

// Picks the `count` corners (inset from the walls by `margin`) that sit
// farthest from any existing furniture piece, then pulls each one partway
// toward the room's center — a lounge chair placed exactly in a geometric
// corner reads as "shoved out of the way"; pulling it in toward the open
// middle of the room reads as "placed in the room" while still keeping the
// "away from existing clutter" property that made corners a good starting
// point. `centerPull` is 0 (stay at the corner) to 1 (go all the way to the
// room's center).
function findOpenSpots(room: RoomLayout, margin: number, count: number, centerPull = 0.45): { x: number; z: number }[] {
  const halfW = Math.max(0.3, room.width / 2 - margin);
  const halfD = Math.max(0.3, room.depth / 2 - margin);
  const corners = [
    { x: -halfW, z: -halfD },
    { x: halfW, z: -halfD },
    { x: -halfW, z: halfD },
    { x: halfW, z: halfD },
  ];

  const scored = corners.map((corner) => ({
    corner,
    // Nearest-neighbor clearance to any existing piece — a corner that's far
    // from its single closest piece of furniture is far from all of them.
    // Distance is measured center-to-corner minus that piece's own footprint
    // radius, not raw center-to-corner: a bulky wardrobe whose center is far
    // off can still have an edge right up against a "far" corner, and a flat
    // center-distance check would score that corner as open when it isn't.
    score: room.furniture.reduce((min, item) => {
      const fp = footprint(item);
      const radius = Math.max(fp.x1 - fp.x0, fp.z1 - fp.z0) / 2;
      const clearance = Math.hypot(item.position.x - corner.x, item.position.z - corner.z) - radius;
      return Math.min(min, clearance);
    }, Infinity),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((entry) => ({
    x: entry.corner.x * (1 - centerPull),
    z: entry.corner.z * (1 - centerPull),
  }));
}

// Repositions a bulky piece (bed, storage) flush against whichever real wall
// it's currently closest to, facing into the room — keeping its position
// along that wall's length close to where it already was, but snapped
// cleanly to the wall instead of wherever the raw scan happened to leave it
// (a few cm off the wall, or angled slightly). Only used when a scenario
// explicitly opts a category into this via REPOSITION_CATEGORIES below.
// RoomPlan scans occasionally report a wildly oversized dimension for a
// piece of furniture (e.g. a "storage" item scanned as 2.55m deep in a
// 3.5m-wide room — see clampFootprint in api/rooms.ts, which only recenters
// such a piece so its bounding box stays inside the room, but leaves the
// dimension itself untouched). Both the wall-hugging offset below and the
// collision check further down need a believable size instead, or a single
// mis-scanned piece ends up floating a meter off its wall and "colliding"
// with the rest of the room no matter where it's placed. Beds legitimately
// run long, so they get a larger ceiling than everything else.
function sanitizedFootprintDims(item: Furniture): { width: number; depth: number } {
  const maxDim = item.category === "bed" ? 2.2 : 1.0;
  return {
    width: Math.min(item.dimensions.width, maxDim),
    depth: Math.min(item.dimensions.depth, maxDim),
  };
}

function snapAgainstNearestWall(item: Furniture, room: RoomLayout): { position: Furniture["position"]; rotationY: number } {
  const dims = sanitizedFootprintDims(item);
  const halfDepth = dims.depth / 2;
  const halfWidth = dims.width / 2;
  let best: { dist: number; x: number; z: number; rotationY: number } | null = null;

  for (const wall of room.walls) {
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) {
      continue;
    }

    const dirX = dx / len;
    const dirZ = dz / len;
    const normX = -dirZ;
    const normZ = dirX;
    const relX = item.position.x - wall.start.x;
    const relZ = item.position.z - wall.start.z;
    const rawAlong = relX * dirX + relZ * dirZ;
    const minAlong = Math.min(halfWidth, len / 2);
    const maxAlong = Math.max(len - halfWidth, len / 2);
    const along = Math.min(Math.max(rawAlong, minAlong), maxAlong);
    const perp = relX * normX + relZ * normZ;
    const dist = Math.abs(perp);

    if (!best || dist < best.dist) {
      const wallThickness = wall.thickness ?? 0.12;
      const inset = wallThickness / 2 + halfDepth + 0.03;
      const side = perp >= 0 ? 1 : -1;
      // The item's own "front" faces local +Z, which at rotationY maps to
      // world (sin, cos) — see the door/chair-facing convention used
      // elsewhere in this app. Facing away from the wall means facing the
      // same side the item's original position was already on.
      const rotationY = Math.atan2(side * normX, side * normZ);
      best = {
        dist,
        x: wall.start.x + dirX * along + normX * inset * side,
        z: wall.start.z + dirZ * along + normZ * inset * side,
        rotationY,
      };
    }
  }

  if (!best) {
    return { position: item.position, rotationY: item.rotationY };
  }

  return { position: { x: best.x, z: best.z }, rotationY: best.rotationY };
}

const WALL_SNAP_CATEGORIES = new Set(["bed", "cabinet"]);

function footprint(item: Furniture) {
  const dims = sanitizedFootprintDims(item);
  const cos = Math.abs(Math.cos(item.rotationY));
  const sin = Math.abs(Math.sin(item.rotationY));
  const halfX = (cos * dims.width + sin * dims.depth) / 2;
  const halfZ = (sin * dims.width + cos * dims.depth) / 2;
  return {
    x0: item.position.x - halfX,
    x1: item.position.x + halfX,
    z0: item.position.z - halfZ,
    z1: item.position.z + halfZ,
  };
}

function footprintsOverlap(a: Furniture, b: Furniture): boolean {
  const fa = footprint(a);
  const fb = footprint(b);
  return fa.x0 < fb.x1 && fa.x1 > fb.x0 && fa.z0 < fb.z1 && fa.z1 > fb.z0;
}

// Walks a furniture piece from its given spot toward the room's center in
// small steps until its footprint clears everything already placed, or we
// run out of steps (in which case the closest-to-clear attempt wins — ending
// up a little further from its corner beats sitting inside another piece).
function resolveOverlapTowardCenter(item: Furniture, others: Furniture[]): Furniture {
  const STEPS = 8;
  let fallback = item;

  for (let step = 0; step <= STEPS; step++) {
    const t = step / STEPS; // 0 = original spot, 1 = room center
    const trial: Furniture = { ...item, position: { x: item.position.x * (1 - t), z: item.position.z * (1 - t) } };
    const blocked = others.some((other) => other.category !== "rug" && footprintsOverlap(trial, other));
    fallback = trial;
    if (!blocked) {
      return trial;
    }
  }

  return fallback;
}

function repositionAgainstWalls(furniture: Furniture[], room: RoomLayout): Furniture[] {
  const snapped = furniture.map((item) => {
    if (!WALL_SNAP_CATEGORIES.has(item.category)) {
      return item;
    }

    const { position, rotationY } = snapAgainstNearestWall(item, room);
    // Carry the same sanitized size into the piece that actually gets
    // rendered, not just the math used to place it — otherwise the wall-snap
    // decides the piece "fits" using a believable size while the mesh itself
    // still draws at the raw, scan-inflated one, so the visible box still
    // swallows half the room. min() is a no-op for anything already sane
    // (a real bed keeps its real footprint).
    const dimensions = { ...item.dimensions, ...sanitizedFootprintDims(item) };
    return { ...item, position, rotationY, dimensions };
  });

  // Each piece is snapped independently, so two snapped pieces (or a snapped
  // piece and one that stayed put) can end up overlapping — most often
  // because a scan reported an unrealistically large dimension for one of
  // them (e.g. a storage unit scanned several meters "deep"). Falling back
  // to that piece's original spot beats leaving it visibly collided with
  // something; a plain re-render of the room never introduces a *new*
  // collision that wasn't already there.
  return snapped.map((item, index) => {
    if (!WALL_SNAP_CATEGORIES.has(item.category)) {
      return item;
    }

    const collides = snapped.some((other, otherIndex) => {
      return otherIndex !== index && other.category !== "rug" && footprintsOverlap(item, other);
    });

    // Revert position/rotation only — keep the sanitized dimensions either
    // way, since those fix a real rendering bug (the raw scanned size) that
    // has nothing to do with where the piece ends up standing.
    return collides ? { ...furniture[index], dimensions: item.dimensions } : item;
  });
}

// Rest / natural / wood — a work desk and its chair don't belong in a rest
// room, so both are dropped entirely (a sofa gets added fresh instead, in
// build() below, rather than the desk chair being reskinned in place). The
// existing storage cabinet becomes a bookshelf — same footprint/position,
// just FurnitureRenderer routed to Bookshelf instead of Storage — in
// Bookshelf's original (undyed) wood look. Everything else goes warm wood.
function restyleForRest(item: Furniture): Furniture {
  switch (item.category) {
    case "bed":
      return withColor(item, "#d8c9ad", "fabric", "wood");
    case "cabinet":
      return { ...withColor(item, "#8b623a", "wood", "wood"), name: "우드 책장" };
    case "rug":
      return withColor(item, "#cdb890", "fabric", "wood");
    default:
      return item;
  }
}

// Work/study / modern / gray — a desk and a proper chair both belong in a
// work room, so nothing gets removed, just retoned minimal/gray (Table.tsx /
// Chair.tsx / Storage.tsx all key their frame/leg/hardware look off
// `theme`). Lighting is deliberately left out of this switch — falling
// through to `default` — so any existing light fixture keeps whatever the
// scan gave it instead of being forced into the new palette.
function restyleForWork(item: Furniture): Furniture {
  switch (item.category) {
    case "bed":
      return withColor(item, "#e4e4e4", "fabric", "gray");
    case "desk":
      return withColor(item, "#d6d6d6", "white", "gray");
    case "chair":
      // theme "gray" also makes Chair.tsx render the cushioned leather
      // office-chair silhouette (pedestal + star base) instead of a plain
      // 4-legged chair — a black leather tone reads as "modern computer
      // chair" instead of a dining chair.
      return { ...withColor(item, "#1c1c1c", "fabric", "gray"), material: { type: "fabric", color: "#1c1c1c", roughness: 0.32, metalness: 0.05 } };
    case "cabinet":
      return withColor(item, "#cfcfcf", "wood", "gray");
    case "rug":
      return withColor(item, "#dcdcdc", "fabric", "gray");
    default:
      return item;
  }
}

export const scenarios: Scenario[] = [
  {
    id: "rest-natural-wood",
    purpose: "rest",
    style: "natural",
    palette: "brown",
    itemIds: ["scenario-rest-sofa", "scenario-rest-lamp", "scenario-rest-plant", "scenario-rest-table", "scenario-rest-rug"],
    addFurnitureIds: ["green-sofa", "floor-lamp", "plant"],
    remove: (item) => item.category === "desk" || item.category === "chair",
    restyle: restyleForRest,
    restyleWindow: (opening) =>
      opening.blind ? { ...opening, blind: { ...opening.blind, type: "curtain", color: "#e8e4da" } } : opening,
    build: (room) => {
      const [sofaSpot, lampSpot, plantSpot, tableSpot] = findOpenSpots(room, 0.5, 4);
      const extras: Furniture[] = [
        {
          id: "scenario-rest-sofa",
          // Name needs "소파" so FurnitureRenderer routes it to Sofa.tsx
          // instead of the single-seat Chair.tsx.
          name: "내추럴 소파",
          category: "chair",
          geometry: "rounded-box",
          dimensions: { width: 1.3, depth: 0.72, height: 0.72 },
          position: sofaSpot,
          rotationY: 0,
          color: "#c9a877",
          material: { type: "fabric", color: "#c9a877", roughness: 0.85, metalness: 0.02 },
          status: "recommended",
          removable: true,
          theme: "wood",
        },
        {
          id: "scenario-rest-lamp",
          name: "플로어 스탠드",
          category: "lighting",
          geometry: "cylinder",
          dimensions: { width: 0.32, depth: 0.32, height: 1.55 },
          position: lampSpot,
          rotationY: 0,
          color: "#3d2a1a",
          material: { type: "metal", color: "#3d2a1a", roughness: 0.35, metalness: 0.6 },
          status: "recommended",
          removable: true,
          theme: "wood",
        },
        {
          id: "scenario-rest-plant",
          // Plant.tsx renders a floor-standing plant (scaled up, resting at
          // floor level) instead of a tabletop vase when the name includes
          // "바닥"/"플로어" — see that component for the mountHeight switch.
          name: "바닥 식물",
          category: "cabinet",
          geometry: "cylinder",
          dimensions: { width: 0.4, depth: 0.4, height: 0.9 },
          position: plantSpot,
          rotationY: 0,
          color: "#5c6e46",
          material: { type: "accent", color: "#5c6e46", roughness: 0.8, metalness: 0 },
          status: "recommended",
          removable: true,
        },
        {
          id: "scenario-rest-table",
          // Category "desk" routes to Table.tsx (see FurnitureRenderer) —
          // a small side table, not an actual work desk.
          name: "조그마한 원목 탁자",
          category: "desk",
          geometry: "box",
          dimensions: { width: 0.46, depth: 0.46, height: 0.4 },
          position: tableSpot,
          rotationY: 0,
          color: "#b98d5e",
          material: { type: "wood", color: "#b98d5e", roughness: 0.5, metalness: 0 },
          status: "recommended",
          removable: true,
          theme: "wood",
        },
      ];

      // Only add a rug if this room doesn't already have one — an existing
      // rug just gets restyled instead of doubling up.
      if (!room.furniture.some((item) => item.category === "rug")) {
        extras.push({
          id: "scenario-rest-rug",
          name: "내추럴 러그",
          category: "rug",
          geometry: "plane",
          dimensions: { width: room.width * 0.55, depth: room.depth * 0.45, height: 0.03 },
          position: { x: 0, z: 0 },
          rotationY: 0,
          color: "#cdb890",
          material: { type: "fabric", color: "#cdb890", roughness: 0.94, metalness: 0 },
          status: "recommended",
          removable: true,
          theme: "wood",
        });
      }

      return extras;
    },
  },
  {
    id: "work-modern-gray",
    purpose: "work",
    style: "modern",
    palette: "gray",
    itemIds: ["scenario-work-bookshelf", "scenario-work-rug"],
    addFurnitureIds: ["shelf-open"],
    remove: () => false,
    restyle: restyleForWork,
    // Blind stays a blind (not swapped to curtain like the rest scenario) —
    // just recolored black, the one explicit "적재적소에 검은색" accent that
    // isn't already covered by the chair's black leather/pedestal look.
    restyleWindow: (opening) => (opening.blind ? { ...opening, blind: { ...opening.blind, color: "#1c1c1c" } } : opening),
    build: (room) => {
      const [shelfSpot] = findOpenSpots(room, 0.4, 1);
      const extras: Furniture[] = [
        {
          id: "scenario-work-bookshelf",
          // Name needs "책장" so FurnitureRenderer routes it to
          // Bookshelf.tsx, which reads item.theme === "gray" (see that
          // component) for muted (not grayscale) shelf boards/books instead
          // of the default warm-wood look.
          name: "미니멀 책장",
          category: "cabinet",
          geometry: "box",
          dimensions: { width: 0.7, depth: 0.32, height: 1.9 },
          position: shelfSpot,
          rotationY: 0,
          color: "#cfcfcf",
          material: { type: "wood", color: "#cfcfcf", roughness: 0.56, metalness: 0 },
          status: "recommended",
          removable: true,
          theme: "gray",
        },
      ];

      // Only add a rug if this room doesn't already have one — an existing
      // rug just gets restyled instead of doubling up.
      if (!room.furniture.some((item) => item.category === "rug")) {
        extras.push({
          id: "scenario-work-rug",
          // A darker charcoal (not the same light gray as the walls/desk) so
          // it grounds the room instead of blending into the floor — the
          // other deliberate dark-accent spot alongside the black blind and
          // black leather chair.
          name: "모던 러그",
          category: "rug",
          geometry: "plane",
          dimensions: { width: room.width * 0.5, depth: room.depth * 0.4, height: 0.03 },
          position: { x: 0, z: 0 },
          rotationY: 0,
          color: "#4a4a4a",
          material: { type: "fabric", color: "#4a4a4a", roughness: 0.9, metalness: 0 },
          status: "recommended",
          removable: true,
          theme: "gray",
        });
      }

      return extras;
    },
  },
];

export function findScenario(purpose: string | null, style: string | null): Scenario | undefined {
  return scenarios.find((scenario) => scenario.purpose === purpose && scenario.style === style);
}

// Removes pieces that don't fit the mood, restyles (color/material/theme)
// whatever survives — never touches position, dimensions, or rotation on a
// kept piece, so the saved layout's spacing never breaks for anything that
// wasn't deliberately dropped — and appends this scenario's extras (skipped
// if already present, so re-running is always safe).
export function applyScenario(room: RoomLayout, scenario: Scenario): RoomLayout {
  const alreadyAdded = room.furniture.some((item) => scenario.itemIds.includes(item.id));
  const survivors = room.furniture.filter((item) => !scenario.remove(item));
  const restyled = survivors.map((item) => scenario.restyle(item));
  // Beds/storage get snapped flush against their nearest real wall — a
  // deliberate "against the wall" layout instead of leaving them at whatever
  // off-wall spot the raw scan happened to record. Done before build() so
  // findOpenSpots() scores open floor space against the *repositioned*
  // pieces, not their old positions.
  const repositioned = repositionAgainstWalls(restyled, room);
  const roomForExtras = { ...room, furniture: repositioned };
  const extras = alreadyAdded ? [] : scenario.build(roomForExtras);
  // findOpenSpots only scores its 4 fixed corners against existing furniture
  // — with 3 extras and 4 corners, at least one pick is nearly always the
  // single worst-scored corner, and its clearance can still be smaller than
  // the extra's own footprint (a wall-snapped wardrobe reaching further into
  // a corner than its center-point score implied). Nudge any extra that
  // still overlaps something toward the room's center, a bit at a time,
  // rather than leaving it visibly embedded in another piece; also checked
  // against extras already placed this pass so two new pieces don't stack.
  const placedExtras: Furniture[] = [];
  for (const extra of extras) {
    placedExtras.push(resolveOverlapTowardCenter(extra, [...repositioned, ...placedExtras]));
  }
  const withExtras = [...repositioned, ...placedExtras];
  const windows = scenario.restyleWindow ? room.windows.map(scenario.restyleWindow) : room.windows;

  return { ...room, furniture: withExtras, windows };
}

// Convenience used by /editor's "AI 추천 생성" handler (see
// EditorPlaceholder.tsx) to check whether the room's saved purpose/style has
// a matching scripted demo mood at all.
export function currentScenario(): Scenario | undefined {
  return findScenario(localStorage.getItem("roomfit:selectedPurpose"), localStorage.getItem("roomfit:selectedStyle"));
}
