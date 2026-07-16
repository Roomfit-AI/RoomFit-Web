import type { Furniture, Opening, RoomLayout, WallSegment } from "../types";
import { safeStorageGet } from "../api/safeStorage";

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
  // Optional per-wall restyle (color/material). Undefined means "leave
  // walls exactly as scanned" — a scanned room's wall color/lighting can
  // vary a lot, so a scenario that wants a guaranteed bright/on-palette
  // look (rather than whatever tone the scan happened to capture) sets this.
  restyleWall?: (wall: WallSegment) => WallSegment;
  // Categories snapped flush against their nearest wall for this mood.
  // Defaults to bed/cabinet (see WALL_SNAP_CATEGORIES) when unset — a
  // scenario only needs this when it wants an additional category (e.g. a
  // desk) pulled into the same "against the wall" treatment, so the mood
  // reads as an actual rearrangement instead of a same-spot recolor.
  wallSnapCategories?: Furniture["category"][];
  // After wall-snapping, pulls the room's desk chair up to whichever desk
  // survived, facing it — so a kept chair doesn't stay wherever the original
  // scan left it once the desk itself has moved to a new wall.
  pairChairWithDesk?: boolean;
  // build()'s extras whose id is listed here get dropped entirely — rather
  // than force-placed into a collision — if resolveOverlapTowardCenter can't
  // find them a genuinely clear spot (see the rest scenario's side table,
  // easy to skip in a small room already full of higher-priority pieces).
  optionalExtraIds?: string[];
  // Categories that shouldn't end up wall-snapped onto the window's own
  // wall — a bookshelf snapped there (just because that's where the raw
  // scan happened to leave it) crowds right up against the window instead
  // of reading as a deliberate placement. Re-snapped to the next-nearest
  // wall instead, after the normal wallSnapCategories pass.
  keepOffWindowWall?: Furniture["category"][];
  // Full custom repositioning for moods whose desired layout is more
  // specific than "snap these categories to their nearest wall" — e.g. a
  // deliberate wall for the desk/chair/bookshelf row plus a *different*
  // (perpendicular) wall for the bed. Takes over entirely from
  // wallSnapCategories/pairChairWithDesk when present.
  arrange?: (survivors: Furniture[], room: RoomLayout) => Furniture[];
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
// run long and desks legitimately run wide (a work-mood desk snapped to its
// own wall is a legitimate ~1.2-1.5m piece, not scan noise), so both get a
// larger ceiling than everything else.
function sanitizedFootprintDims(item: Furniture): { width: number; depth: number } {
  const maxDim = item.category === "bed" ? 2.2 : item.category === "desk" ? 2.0 : 1.0;
  return {
    width: Math.min(item.dimensions.width, maxDim),
    depth: Math.min(item.dimensions.depth, maxDim),
  };
}

function snapAgainstNearestWall(
  item: Furniture,
  room: RoomLayout,
  pushToCorner = false,
  wallsOverride?: RoomLayout["walls"],
): { position: Furniture["position"]; rotationY: number } {
  const dims = sanitizedFootprintDims(item);
  const halfDepth = dims.depth / 2;
  const halfWidth = dims.width / 2;
  let best: { dist: number; x: number; z: number; rotationY: number } | null = null;

  for (const wall of wallsOverride ?? room.walls) {
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
    // A bed reads as "placed" rather than "shoved in a corner" everywhere
    // else in this app, but frees up much more usable floor when it's
    // actually pushed flush into the nearest corner instead of just
    // centered wherever the raw scan happened to leave it along the wall.
    const along = pushToCorner
      ? rawAlong - minAlong <= maxAlong - rawAlong
        ? minAlong
        : maxAlong
      : Math.min(Math.max(rawAlong, minAlong), maxAlong);
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

// The item's own "front" faces local +Z, which at rotationY maps to this
// world-space direction — same convention snapAgainstNearestWall uses above.
function frontDirection(rotationY: number): { x: number; z: number } {
  return { x: Math.sin(rotationY), z: Math.cos(rotationY) };
}

function wallGeometry(wall: { start: { x: number; z: number }; end: { x: number; z: number } }) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const len = Math.hypot(dx, dz) || 1;
  return { dirX: dx / len, dirZ: dz / len, len };
}

// Rooms are always centered on the origin (see toWallSegment in
// api/rooms.ts, and every hand-authored sample room) — so "inward" is just
// "toward (0,0)" from the wall's midpoint, unlike RoomViewer.tsx's general
// polygon-center version of this same idea.
function inwardNormalForWall(wall: { start: { x: number; z: number }; end: { x: number; z: number } }): { x: number; z: number } {
  const { dirX, dirZ } = wallGeometry(wall);
  const normal = { x: -dirZ, z: dirX };
  const midX = (wall.start.x + wall.end.x) / 2;
  const midZ = (wall.start.z + wall.end.z) / 2;
  const facesOrigin = normal.x * -midX + normal.z * -midZ >= 0;
  return facesOrigin ? normal : { x: -normal.x, z: -normal.z };
}

function nearestWallToPoint(position: { x: number; z: number }, walls: RoomLayout["walls"]): RoomLayout["walls"][number] | null {
  let best: RoomLayout["walls"][number] | null = null;
  let bestDist = Infinity;

  for (const wall of walls) {
    const { dirX, dirZ, len } = wallGeometry(wall);
    if (len < 0.5) {
      continue;
    }

    const relX = position.x - wall.start.x;
    const relZ = position.z - wall.start.z;
    const along = Math.min(Math.max(relX * dirX + relZ * dirZ, 0), len);
    const nearX = wall.start.x + dirX * along;
    const nearZ = wall.start.z + dirZ * along;
    const dist = Math.hypot(position.x - nearX, position.z - nearZ);

    if (dist < bestDist) {
      bestDist = dist;
      best = wall;
    }
  }

  return best;
}

// The backend only ever gives an opening a symbolic wall side plus a scalar
// offset (see toOpening()'s wallId snap in api/rooms.ts) — by the time it
// reaches here as an Opening, wallId (when present) already names the real
// wall segment it was snapped to, so prefer that over re-deriving it from
// position alone.
// How much open floor a point has before hitting any wall — used to pick
// which side of a corner-pushed bed actually has room for something (the
// plant), instead of a fixed direction that made sense when beds sat
// centered on their wall but can now point straight into the side wall the
// bed is pushed up against.
function clearanceToWalls(point: { x: number; z: number }, walls: RoomLayout["walls"]): number {
  let min = Infinity;

  for (const wall of walls) {
    const { dirX, dirZ, len } = wallGeometry(wall);
    if (len < 0.5) {
      continue;
    }

    const relX = point.x - wall.start.x;
    const relZ = point.z - wall.start.z;
    const along = Math.min(Math.max(relX * dirX + relZ * dirZ, 0), len);
    const nearX = wall.start.x + dirX * along;
    const nearZ = wall.start.z + dirZ * along;
    min = Math.min(min, Math.hypot(point.x - nearX, point.z - nearZ));
  }

  return min;
}

function wallForOpening(opening: Opening | undefined, walls: RoomLayout["walls"]): RoomLayout["walls"][number] | null {
  if (!opening) {
    return null;
  }

  if (opening.wallId) {
    const explicit = walls.find((wall) => wall.id === opening.wallId);
    if (explicit) {
      return explicit;
    }
  }

  return nearestWallToPoint(opening.position, walls);
}

// Re-snaps any survivor of the given categories off the window's wall (see
// Scenario.keepOffWindowWall) — the generic wall-snap pass just picks
// whichever wall is nearest to a piece's original scan position, which can
// happen to be the window's own wall, crowding a bookshelf right up against
// it instead of reading as a deliberate placement.
function distanceToWallSegment(point: { x: number; z: number }, wall: RoomLayout["walls"][number]): number {
  const { dirX, dirZ, len } = wallGeometry(wall);
  if (len < 0.01) {
    return Math.hypot(point.x - wall.start.x, point.z - wall.start.z);
  }

  const relX = point.x - wall.start.x;
  const relZ = point.z - wall.start.z;
  const along = Math.min(Math.max(relX * dirX + relZ * dirZ, 0), len);
  const nearX = wall.start.x + dirX * along;
  const nearZ = wall.start.z + dirZ * along;
  return Math.hypot(point.x - nearX, point.z - nearZ);
}

// Finds whichever other wall has an endpoint nearest `point` — used to find
// the wall that physically meets a given corner of another wall (e.g. the
// far end of the window wall), so a piece can "wrap around" from one wall
// onto the one it actually connects to there.
function wallMeetingPoint(point: { x: number; z: number }, walls: RoomLayout["walls"], excludeId: string): RoomLayout["walls"][number] | null {
  let best: RoomLayout["walls"][number] | null = null;
  let bestDist = Infinity;

  for (const wall of walls) {
    if (wall.id === excludeId) {
      continue;
    }

    const dist = Math.min(Math.hypot(wall.start.x - point.x, wall.start.z - point.z), Math.hypot(wall.end.x - point.x, wall.end.z - point.z));

    if (dist < bestDist) {
      bestDist = dist;
      best = wall;
    }
  }

  return best;
}

// How far a piece needs to sit from whichever end of its wall meets the
// window wall's corner before it stops reading as "jammed in next to the
// window."
const WINDOW_CORNER_CLEARANCE = 0.5;

function keepOffWindowWall(furniture: Furniture[], room: RoomLayout, categories: Set<string>): Furniture[] {
  const windowWall = wallForOpening(room.windows[0], room.walls);

  if (!windowWall) {
    return furniture;
  }

  const otherWalls = room.walls.filter((wall) => wall.id !== windowWall.id);

  return furniture.map((item) => {
    if (!categories.has(item.category)) {
      return item;
    }

    // Re-snap off the window's own wall first if that's where the generic
    // wall-snap left it — otherwise keep whatever wall it's already on
    // (most often not the window wall to begin with, just possibly still
    // close to the corner where that wall meets it).
    const currentWall = nearestWallToPoint(item.position, room.walls);
    const isOnWindowWall = currentWall?.id === windowWall.id;
    const { position, rotationY } = isOnWindowWall
      ? snapAgainstNearestWall(item, room, false, otherWalls)
      : { position: item.position, rotationY: item.rotationY };

    const wall = nearestWallToPoint(position, otherWalls);
    if (!wall) {
      return { ...item, position, rotationY };
    }

    // This wall almost certainly meets the window's wall at one of its two
    // ends — only nudge if the piece is actually close to that end; leave
    // it alone if it's already well clear.
    const { dirX, dirZ, len } = wallGeometry(wall);
    const dims = sanitizedFootprintDims(item);
    const halfWidth = dims.width / 2;
    const minAlong = Math.min(halfWidth, len / 2);
    const maxAlong = Math.max(len - halfWidth, len / 2);
    const relX = position.x - wall.start.x;
    const relZ = position.z - wall.start.z;
    const currentAlong = relX * dirX + relZ * dirZ;
    const startNearWindow = distanceToWallSegment(wall.start, windowWall) < distanceToWallSegment(wall.end, windowWall);
    const nearEndAlong = startNearWindow ? minAlong : maxAlong;
    const distFromNearEnd = Math.abs(currentAlong - nearEndAlong);

    if (distFromNearEnd >= WINDOW_CORNER_CLEARANCE) {
      return { ...item, position, rotationY };
    }

    const pushedAlong = startNearWindow ? nearEndAlong + WINDOW_CORNER_CLEARANCE : nearEndAlong - WINDOW_CORNER_CLEARANCE;
    const nudgedAlong = Math.min(Math.max(pushedAlong, minAlong), maxAlong);
    const inward = inwardNormalForWall(wall);
    const inset = (wall.thickness ?? 0.12) / 2 + dims.depth / 2 + 0.03;

    return {
      ...item,
      position: {
        x: wall.start.x + dirX * nudgedAlong + inward.x * inset,
        z: wall.start.z + dirZ * nudgedAlong + inward.z * inset,
      },
      rotationY,
    };
  });
}

// Places `items` flush against `wall` in a row, evenly spaced by `gap`,
// centered along the wall's length, all facing into the room — used for
// moods that want a deliberate "these pieces share a wall, in this order"
// composition instead of each piece being wall-snapped independently.
function arrangeRowAgainstWall(
  wall: RoomLayout["walls"][number],
  items: { width: number; depth: number }[],
  gap: number,
  anchor: "center" | "start" = "center",
): { position: { x: number; z: number }; rotationY: number }[] {
  const { dirX, dirZ, len } = wallGeometry(wall);
  const inward = inwardNormalForWall(wall);
  const rotationY = Math.atan2(inward.x, inward.z);
  const totalWidth = items.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, items.length - 1);
  // "start" pins the row flush to the wall's own start corner (leaving the
  // far end free for something else, like a bed wrapping around it) instead
  // of centering the group along the whole wall.
  let cursor = anchor === "start" ? 0 : (len - totalWidth) / 2;

  return items.map((item) => {
    const centerAlong = cursor + item.width / 2;
    const alongX = wall.start.x + dirX * centerAlong;
    const alongZ = wall.start.z + dirZ * centerAlong;
    const inset = (wall.thickness ?? 0.12) / 2 + item.depth / 2 + 0.03;
    cursor += item.width + gap;

    return {
      position: { x: alongX + inward.x * inset, z: alongZ + inward.z * inset },
      rotationY,
    };
  });
}

// Pulls the room's desk chair (a "chair" that isn't actually a sofa — see
// FurnitureRenderer's name-based routing) up against whichever desk survived
// this mood, facing it. No-ops if either piece is missing so a room without
// a desk, or one whose chair got removed by the mood, is left untouched.
function pairChairWithDesk(furniture: Furniture[], gap = 0.12): Furniture[] {
  const desk = furniture.find((item) => item.category === "desk");
  const chair = furniture.find((item) => {
    if (item.category !== "chair") {
      return false;
    }
    const name = item.name.toLowerCase();
    return !name.includes("소파") && !name.includes("sofa") && !name.includes("couch");
  });

  if (!desk || !chair) {
    return furniture;
  }

  const front = frontDirection(desk.rotationY);
  const offset = desk.dimensions.depth / 2 + chair.dimensions.depth / 2 + gap;
  const position = { x: desk.position.x + front.x * offset, z: desk.position.z + front.z * offset };
  // Faces back toward the desk — opposite of the desk's own into-the-room
  // facing — so sitting in it means looking at the desk, not away from it.
  const rotationY = desk.rotationY + Math.PI;

  return furniture.map((item) => (item.id === chair.id ? { ...item, position, rotationY } : item));
}

// Exported for localValidation.ts, which needs the same footprint math to
// approximate collision/boundary checks locally for scripted-scenario rooms
// (see EditorPlaceholder.tsx) that never hit the backend's real validator.
export function footprint(item: Furniture) {
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

export function footprintsOverlap(a: Furniture, b: Furniture): boolean {
  const fa = footprint(a);
  const fb = footprint(b);
  return fa.x0 < fb.x1 && fa.x1 > fb.x0 && fa.z0 < fb.z1 && fa.z1 > fb.z0;
}

// Walks a furniture piece from its given spot toward the room's center in
// small steps until its footprint clears everything already placed, or we
// run out of steps (in which case the closest-to-clear attempt wins — ending
// up a little further from its corner beats sitting inside another piece).
// `resolved` tells a caller whether a genuinely clear spot was found, for
// pieces that are better off skipped entirely than force-placed into a
// collision (see the rest scenario's side table).
function resolveOverlapTowardCenter(item: Furniture, others: Furniture[]): { item: Furniture; resolved: boolean } {
  const STEPS = 8;
  let fallback = item;

  for (let step = 0; step <= STEPS; step++) {
    const t = step / STEPS; // 0 = original spot, 1 = room center
    const trial: Furniture = { ...item, position: { x: item.position.x * (1 - t), z: item.position.z * (1 - t) } };
    const blocked = others.some((other) => other.category !== "rug" && footprintsOverlap(trial, other));
    fallback = trial;
    if (!blocked) {
      return { item: trial, resolved: true };
    }
  }

  return { item: fallback, resolved: false };
}

function repositionAgainstWalls(furniture: Furniture[], room: RoomLayout, categories: Set<string> = WALL_SNAP_CATEGORIES): Furniture[] {
  const snapped = furniture.map((item) => {
    if (!categories.has(item.category)) {
      return item;
    }

    const { position, rotationY } = snapAgainstNearestWall(item, room, item.category === "bed");
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
    if (!categories.has(item.category)) {
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
// Bright warm off-white — used for walls only (see restyleWall below). The
// bookshelf briefly matched this exact color too, but that read as "책장이
// 사라진" rather than a deliberate look — it's back to its own bright wood
// tone instead (see NATURAL_WOOD_COLOR).
const NATURAL_WALL_COLOR = "#f6f1e6";
// The natural scenario's shared "light oak" tone — bookshelf carcass, its
// shelf boards/dividers (see Bookshelf.tsx), and the small side table all use
// this same value so they read as one consistent bright-wood palette instead
// of the shelf boards' own separate, much darker hardcoded brown standing out.
const NATURAL_WOOD_COLOR = "#c9a874";

function restyleForRest(item: Furniture): Furniture {
  switch (item.category) {
    case "bed":
      // Brightened from the original #d8c9ad — paired with Bed.tsx's own
      // "wood" theme frame/duvet colors (also brightened), a light
      // near-white tone instead of a deeper tan keeps the whole bed reading
      // "화이트+우드" rather than dim/beige.
      return withColor(item, "#f0e8d8", "fabric", "wood");
    case "cabinet":
      return { ...withColor(item, NATURAL_WOOD_COLOR, "wood", "wood"), name: "우드 책장" };
    case "rug":
      return withColor(item, "#e3d3b8", "fabric", "wood");
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
      // The room's own existing storage becomes the bookshelf directly
      // (same footprint/position going in, repositioned in arrange() below)
      // rather than adding a second, separate bookshelf extra alongside it —
      // one real cabinet re-cast as the bookshelf reads as "the bookshelf,"
      // two similarly-toned boxes crowding the same corner reads as clutter.
      return { ...withColor(item, "#cfcfcf", "wood", "gray"), name: "미니멀 책장" };
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
    itemIds: [
      "scenario-rest-sofa",
      "scenario-rest-lamp",
      "scenario-rest-plant",
      "scenario-rest-plant-corner",
      "scenario-rest-table",
      "scenario-rest-rug",
    ],
    addFurnitureIds: ["green-sofa", "floor-lamp", "plant"],
    optionalExtraIds: ["scenario-rest-table", "scenario-rest-plant-corner"],
    keepOffWindowWall: ["cabinet"],
    remove: (item) => item.category === "desk" || item.category === "chair",
    restyle: restyleForRest,
    restyleWindow: (opening) =>
      opening.blind ? { ...opening, blind: { ...opening.blind, type: "curtain", color: "#e8e4da" } } : opening,
    // A scanned room's own wall color/material varies a lot and can read as
    // dim depending on the scan's lighting — this guarantees a bright, warm
    // off-white regardless of what the scan captured, rather than leaving
    // "화이트" up to chance.
    restyleWall: (wall) => ({ ...wall, material: { color: NATURAL_WALL_COLOR, roughness: 0.85 } }),
    build: (room) => {
      const [tableSpot] = findOpenSpots(room, 0.5, 1);
      const bed = room.furniture.find((item) => item.category === "bed");
      const bookshelf = room.furniture.find((item) => item.category === "cabinet");

      // The sofa sits beside the bookshelf (sharing its wall, like a small
      // reading nook) rather than an independent corner pick — "소파는
      // 침대방향을 보면서 책장 옆에 붙어있어야함." Its rotation then gets
      // turned to actually face the bed instead of just "into the room from
      // this wall," so it reads as angled toward the rest of the room
      // instead of staring at the wall it's snapped against.
      let sofaSpot = findOpenSpots(room, 0.5, 1)[0];
      let sofaRotation = 0;
      const sofaDims = { width: 1.3, depth: 0.72 };

      if (bookshelf) {
        const bookshelfWall = nearestWallToPoint(bookshelf.position, room.walls);
        if (bookshelfWall) {
          const slots = arrangeRowAgainstWall(bookshelfWall, [sanitizedFootprintDims(bookshelf), sofaDims], 0.16);
          sofaSpot = slots[1].position;
          sofaRotation = slots[1].rotationY;
        }
      }

      if (bed) {
        // Snapped to the nearest 90° increment rather than the raw angle
        // toward the bed — an in-between diagonal reads as "crooked"/broken
        // on a low-poly box-shaped sofa with no strong directional cues,
        // not as "deliberately facing the bed." Whichever cardinal direction
        // (of the 4) points closest to the bed is still an actual
        // improvement over always facing straight off the wall.
        const rawFacingAngle = Math.atan2(bed.position.x - sofaSpot.x, bed.position.z - sofaSpot.z);
        sofaRotation = Math.round(rawFacingAngle / (Math.PI / 2)) * (Math.PI / 2);

        // Facing the bed instead of "into the room from this wall" changes
        // the sofa's effective footprint — a diagonal rotation reaches
        // further toward the wall than the axis-aligned inset
        // arrangeRowAgainstWall assumed, which can push it past the room
        // boundary. Pull it back in just enough to clear it again.
        const halfWidth = room.width / 2;
        const halfDepth = room.depth / 2;
        const cos = Math.abs(Math.cos(sofaRotation));
        const sin = Math.abs(Math.sin(sofaRotation));
        const halfX = (cos * sofaDims.width + sin * sofaDims.depth) / 2;
        const halfZ = (sin * sofaDims.width + cos * sofaDims.depth) / 2;
        sofaSpot = {
          x: Math.min(Math.max(sofaSpot.x, -halfWidth + halfX), halfWidth - halfX),
          z: Math.min(Math.max(sofaSpot.z, -halfDepth + halfZ), halfDepth - halfZ),
        };
      }

      // The lamp and plant are deliberately *not* independent corner picks —
      // a lamp reads as "placed for the sofa" only if it's actually next to
      // it, and a plant reads as part of the bed nook only if it sits beside
      // the bed, not off in whichever other corner scored best in isolation.
      const lampSpot = { x: sofaSpot.x + (sofaSpot.x >= 0 ? -0.6 : 0.6), z: sofaSpot.z + (sofaSpot.z >= 0 ? -0.5 : 0.5) };
      const plantDims = { width: 0.42, depth: 0.42 };
      const windowWall = wallForOpening(room.windows[0], room.walls);
      const plantSpot =
        bed && windowWall
          ? (() => {
              // Flush against the *same* wall as the window, right beside the
              // bed's own corner — "원래 침대 옆에 있는 식물은 창문쪽 벽으로
              // 붙여줘" — instead of just offset off the bed into open floor.
              const { dirX, dirZ, len } = wallGeometry(windowWall);
              const inward = inwardNormalForWall(windowWall);
              const relX = bed.position.x - windowWall.start.x;
              const relZ = bed.position.z - windowWall.start.z;
              const bedAlong = relX * dirX + relZ * dirZ;
              // Bed is pushed into whichever end of this wall is nearest its
              // original spot — extend the plant toward the wall's *other*
              // end, away from that corner, not back into it.
              const awaySign = bedAlong <= len / 2 ? 1 : -1;
              const bedHalfWidth = sanitizedFootprintDims(bed).width / 2;
              const gap = 0.16;
              const along = bedAlong + awaySign * (bedHalfWidth + gap + plantDims.width / 2);
              const clampedAlong = Math.min(Math.max(along, plantDims.width / 2), len - plantDims.width / 2);
              const inset = (windowWall.thickness ?? 0.12) / 2 + plantDims.depth / 2 + 0.03;
              return {
                x: windowWall.start.x + dirX * clampedAlong + inward.x * inset,
                z: windowWall.start.z + dirZ * clampedAlong + inward.z * inset,
              };
            })()
          : bed
            ? (() => {
                const side = { x: Math.cos(bed.rotationY), z: -Math.sin(bed.rotationY) };
                const offset = bed.dimensions.width / 2 + 0.32;
                const candidateA = { x: bed.position.x + side.x * offset, z: bed.position.z + side.z * offset };
                const candidateB = { x: bed.position.x - side.x * offset, z: bed.position.z - side.z * offset };
                return clearanceToWalls(candidateA, room.walls) >= clearanceToWalls(candidateB, room.walls) ? candidateA : candidateB;
              })()
            : findOpenSpots(room, 0.4, 1)[0];

      // A second, differently-designed plant (see Plant.tsx's "몬스테라"
      // branch) in whichever room corner sits closest to the sofa — "소파쪽
      // 구석에 하나 더 배치."
      const cornerMargin = 0.35;
      const cornerHalfW = Math.max(0.3, room.width / 2 - cornerMargin);
      const cornerHalfD = Math.max(0.3, room.depth / 2 - cornerMargin);
      const roomCorners = [
        { x: -cornerHalfW, z: -cornerHalfD },
        { x: cornerHalfW, z: -cornerHalfD },
        { x: -cornerHalfW, z: cornerHalfD },
        { x: cornerHalfW, z: cornerHalfD },
      ];
      const sofaCornerSpot = roomCorners.reduce((closest, corner) =>
        Math.hypot(corner.x - sofaSpot.x, corner.z - sofaSpot.z) < Math.hypot(closest.x - sofaSpot.x, closest.z - sofaSpot.z) ? corner : closest,
      );
      const extras: Furniture[] = [
        {
          id: "scenario-rest-sofa",
          // Name needs "소파" so FurnitureRenderer routes it to Sofa.tsx
          // instead of the single-seat Chair.tsx.
          name: "내추럴 소파",
          category: "chair",
          geometry: "rounded-box",
          dimensions: { width: sofaDims.width, depth: sofaDims.depth, height: 0.72 },
          position: sofaSpot,
          rotationY: sofaRotation,
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
          color: "#8a6a45",
          material: { type: "metal", color: "#8a6a45", roughness: 0.35, metalness: 0.6 },
          status: "recommended",
          removable: true,
          theme: "wood",
        },
        {
          id: "scenario-rest-plant",
          // Plant.tsx renders a distinct slender snake-plant look (terracotta
          // pot, tapered upright leaves) instead of the small tabletop-vase
          // bouquet when the name includes "바닥"/"플로어" — see that
          // component. Sized as a proper floor plant without going oversized.
          name: "바닥 식물",
          category: "cabinet",
          geometry: "cylinder",
          dimensions: { width: 0.42, depth: 0.42, height: 0.82 },
          position: plantSpot,
          rotationY: 0,
          color: "#5c6e46",
          material: { type: "accent", color: "#5c6e46", roughness: 0.8, metalness: 0 },
          status: "recommended",
          removable: true,
        },
        {
          id: "scenario-rest-plant-corner",
          // "몬스테라" in the name switches Plant.tsx to its second,
          // round-leaf design (woven-basket pot, stemmed leaf blobs) so this
          // doesn't just read as the same plant duplicated in another spot.
          name: "몬스테라 화분",
          category: "cabinet",
          geometry: "cylinder",
          dimensions: { width: plantDims.width, depth: plantDims.depth, height: 0.72 },
          position: sofaCornerSpot,
          rotationY: Math.PI / 2,
          color: "#3d7040",
          material: { type: "accent", color: "#3d7040", roughness: 0.75, metalness: 0 },
          status: "recommended",
          removable: true,
        },
      ];

      // A small room where the sofa/lamp/plant already used up the open
      // floor can't always also fit the little side table — it's in
      // optionalExtraIds below, so applyScenario drops it entirely rather
      // than force-placing it into a collision when that happens.
      extras.push({
        id: "scenario-rest-table",
        // Category "desk" routes to Table.tsx (see FurnitureRenderer) — a
        // small side table, not an actual work desk.
        name: "조그마한 원목 탁자",
        category: "desk",
        geometry: "box",
        dimensions: { width: 0.46, depth: 0.46, height: 0.4 },
        position: tableSpot,
        rotationY: 0,
        color: "#c9a874",
        material: { type: "wood", color: "#c9a874", roughness: 0.5, metalness: 0 },
        status: "recommended",
        removable: true,
        theme: "wood",
      });

      // Only add a rug if this room doesn't already have one — an existing
      // rug just gets restyled instead of doubling up.
      if (!room.furniture.some((item) => item.category === "rug")) {
        extras.push({
          id: "scenario-rest-rug",
          name: "내추럴 러그",
          category: "rug",
          geometry: "plane",
          dimensions: { width: room.width * 0.56, depth: room.depth * 0.5, height: 0.03 },
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
    // A deliberate composition instead of independent nearest-wall snapping:
    // bookshelf, desk (+ its chair out front), and a storage box share the
    // window's wall in that order, while the bed goes on a wall perpendicular
    // to it (avoiding the door's wall when there's a choice) — "책장을
    // 창문과 같은 방향으로 놓고 옆에 책상+의자, 그 옆에 수납장. 침대는 90도
    // 돌려서 다른 벽에" per the demo's explicit request, rather than each
    // piece landing on whichever wall happened to be geometrically nearest.
    arrange: (survivors, room) => {
      const windowWall = wallForOpening(room.windows[0], room.walls) ?? room.walls[0] ?? null;
      const bed = survivors.find((item) => item.category === "bed");
      // A raw scan occasionally has more than one "desk"-labeled surface
      // (e.g. a real desk plus a smaller counter/nightstand the scanner also
      // called a desk) — the row/chair pairing is built around the single
      // biggest one; any others are treated as a coffee table on the rug
      // further below.
      const allDesks = survivors.filter((item) => item.category === "desk");
      const desk = allDesks.reduce<Furniture | undefined>(
        (largest, item) => (!largest || item.dimensions.width * item.dimensions.depth > largest.dimensions.width * largest.dimensions.depth ? item : largest),
        undefined,
      );
      const otherDesks = allDesks.filter((item) => item.id !== desk?.id);
      const chair = survivors.find((item) => {
        if (item.category !== "chair") {
          return false;
        }
        const name = item.name.toLowerCase();
        return !name.includes("소파") && !name.includes("sofa") && !name.includes("couch");
      });
      const bookshelf = survivors.find((item) => item.category === "cabinet");

      let next = survivors;
      let deskAlong: number | null = null;

      // 책상은 창문 바로 아래(창문벽 기준 가운데)에 — desk goes first so the
      // bookshelf placed right after it can sit snug against its actual
      // position instead of an independent corner.
      if (windowWall && desk) {
        const windowOpening = room.windows[0];
        const deskDims = sanitizedFootprintDims(desk);
        const { dirX, dirZ } = wallGeometry(windowWall);
        const inward = inwardNormalForWall(windowWall);
        const rotationY = Math.atan2(inward.x, inward.z);
        // "창문벽을 기준으로 창문 바로 아래로" — centered on the window's own
        // position along the wall, not the wall's own midpoint (the window
        // itself isn't always dead-center on its wall).
        const relX = (windowOpening?.position.x ?? (windowWall.start.x + windowWall.end.x) / 2) - windowWall.start.x;
        const relZ = (windowOpening?.position.z ?? (windowWall.start.z + windowWall.end.z) / 2) - windowWall.start.z;
        const along = relX * dirX + relZ * dirZ;
        deskAlong = along;
        const inset = (windowWall.thickness ?? 0.12) / 2 + deskDims.depth / 2 + 0.03;
        const deskPosition = {
          x: windowWall.start.x + dirX * along + inward.x * inset,
          z: windowWall.start.z + dirZ * along + inward.z * inset,
        };

        next = next.map((item) =>
          item.id === desk.id ? { ...item, position: deskPosition, rotationY, dimensions: { ...item.dimensions, ...deskDims } } : item,
        );

        if (chair) {
          // Pulled back a little from a dead-on overlap — "의자는 너무
          // 겹치니까 조금만 뒤로 이격시키고" — rather than centered exactly
          // on the desk.
          const pullBack = 0.18;
          next = pairChairWithDesk(next, pullBack - (desk.dimensions.depth / 2 + chair.dimensions.depth / 2));
        }
      }

      // 책장은 그 창문쪽 책상 옆으로 — snug against the desk's own along-wall
      // position (whichever side of it has room), facing 270° (90°×3) from
      // the wall's usual "flush, facing into the room" orientation so its
      // spine reads sideways next to the desk instead of lying flat like it.
      if (windowWall && bookshelf) {
        const shelfDims = sanitizedFootprintDims(bookshelf);
        const { dirX, dirZ, len } = wallGeometry(windowWall);
        const inward = inwardNormalForWall(windowWall);
        // Facing straight into the room, like the desk right next to it —
        // "책장이 정면을 보게" — not rotated sideways.
        const rotationY = Math.atan2(inward.x, inward.z);
        const gap = 0.04;
        const anchorAlong = deskAlong ?? len / 2;
        const deskHalfWidth = desk ? sanitizedFootprintDims(desk).width / 2 : 0;
        const maxAlong = Math.max(len - shelfDims.width / 2, len / 2);
        // Actually flush against the *big* desk takes priority over staying
        // clear of the wall's own corner — clamping this to "at least
        // half the shelf's width from wall.start" was quietly leaving a gap
        // and reading as "next to some other, smaller piece" instead of the
        // desk it's supposed to be beside. A few cm past the corner is a
        // much smaller problem than that.
        const shelfAlong = Math.min(anchorAlong - deskHalfWidth - gap - shelfDims.width / 2, maxAlong);
        const inset = (windowWall.thickness ?? 0.12) / 2 + shelfDims.depth / 2 + 0.03;
        const shelfPosition = {
          x: windowWall.start.x + dirX * shelfAlong + inward.x * inset,
          z: windowWall.start.z + dirZ * shelfAlong + inward.z * inset,
        };

        next = next.map((item) =>
          item.id === bookshelf.id ? { ...item, position: shelfPosition, rotationY, dimensions: { ...item.dimensions, ...shelfDims } } : item,
        );
      }

      if (bed) {
        const bedWall = (windowWall && wallMeetingPoint(windowWall.end, room.walls, windowWall.id)) ?? nearestWallToPoint(bed.position, room.walls);

        if (bedWall) {
          const bedDims = sanitizedFootprintDims(bed);
          const cornerRef = windowWall?.end ?? bed.position;

          // Rotated 90° from the usual "headboard against the wall" pose —
          // width (the short side) faces the window wall instead of depth
          // (the long side) reaching out into the room — "침대는 90도로
          // 돌려서 너비부분이 창문벽으로 가게."
          const inward = inwardNormalForWall(bedWall);
          const baseRotationY = Math.atan2(inward.x, inward.z) - Math.PI / 2;
          // Bed.tsx anchors the headboard/pillow at local -Z, so this
          // rotation's frontDirection (local +Z in world space) points
          // toward the *foot* of the bed, not the head.
          const footDirection = frontDirection(baseRotationY);

          const { dirX, dirZ, len } = wallGeometry(bedWall);
          const halfLength = bedDims.depth / 2; // real depth (1.96) now runs along the wall
          const halfReachIntoRoom = bedDims.width / 2; // real width (1.0) now reaches into the room
          const minAlong = Math.min(halfLength, len / 2);
          const maxAlong = Math.max(len - halfLength, len / 2);

          const relX = cornerRef.x - bedWall.start.x;
          const relZ = cornerRef.z - bedWall.start.z;
          const cornerAlong = relX * dirX + relZ * dirZ;
          // The *head* end needs to land at the corner (not just the
          // center) — "지금은 침대방향도 거꾸로" — so the center sits one
          // half-length further along the wall, in the foot's own
          // direction, from the corner itself.
          const footAlongComponent = footDirection.x * dirX + footDirection.z * dirZ;
          const centerAlong = Math.min(Math.max(cornerAlong + footAlongComponent * halfLength, minAlong), maxAlong);

          const inset = (bedWall.thickness ?? 0.12) / 2 + halfReachIntoRoom + 0.03;
          const bedPosition = {
            x: bedWall.start.x + dirX * centerAlong + inward.x * inset,
            z: bedWall.start.z + dirZ * centerAlong + inward.z * inset,
          };
          // Flipped 180° from the position math above (which still targets
          // the same corner) — "침대를 일단 90도로 2번만 회전시켜": the
          // position stays, only the facing/head-foot direction flips.
          const bedRotationY = baseRotationY + Math.PI;

          next = next.map((item) =>
            item.id === bed.id
              ? { ...item, position: bedPosition, rotationY: bedRotationY, dimensions: { ...item.dimensions, ...bedDims } }
              : item,
          );

          // The row and the bed are each placed independently against their
          // own wall — for a tight corner they can still just barely overlap
          // each other. Nudge the bed toward the room's center a little if
          // that clears it, but only if it actually finds a genuinely open
          // spot: resolveOverlapTowardCenter's fallback when nothing along
          // the way is clear is just the room's dead center, which for a
          // piece this size reads far worse (floating detached in the middle
          // of the floor) than staying flush in its corner with a small
          // overlap into the desk it's sharing the corner with.
          const { item: resolvedBed, resolved } = resolveOverlapTowardCenter(
            next.find((item) => item.id === bed.id) as Furniture,
            next.filter((item) => item.id !== bed.id),
          );
          if (resolved) {
            next = next.map((item) => (item.id === bed.id ? resolvedBed : item));
          }
        }
      }

      // A second desk-labeled surface from the scan reads as a coffee table
      // once there's already a proper desk in the row — sat on the rug
      // (room center, where build() below places it) instead of wall-snapped
      // off somewhere unrelated: "러그 위에 탁자를 두는 형식으로 바꾸자."
      for (const extraDesk of otherDesks) {
        next = next.map((item) =>
          item.id === extraDesk.id
            ? { ...item, position: { x: 0, z: 0 }, rotationY: 0, dimensions: { ...item.dimensions, ...sanitizedFootprintDims(item) } }
            : item,
        );
      }

      return next;
    },
    build: (room) => {
      const extras: Furniture[] = [];

      // Safety net for a room with no existing cabinet at all to become the
      // bookshelf (arrange() above only repositions one if it's already
      // there) — keeps a bookshelf-less room from ending up with no
      // bookshelf at all, using the old independent-corner placement.
      if (!room.furniture.some((item) => item.category === "cabinet")) {
        const [shelfSpot] = findOpenSpots(room, 0.4, 1);
        extras.push({
          id: "scenario-work-bookshelf",
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
        });
      }

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
  // Beds/storage (and, for moods that opt in, a desk too) get snapped flush
  // against their nearest real wall — a deliberate "against the wall" layout
  // instead of leaving them at whatever off-wall spot the raw scan happened
  // to record. Done before build() so findOpenSpots() scores open floor
  // space against the *repositioned* pieces, not their old positions. A mood
  // with a more specific composition in mind (see work-modern-gray) supplies
  // `arrange` instead, which takes over entirely.
  let repositioned: Furniture[];

  if (scenario.arrange) {
    repositioned = scenario.arrange(restyled, room);
  } else {
    const wallSnapCategories = new Set(scenario.wallSnapCategories ?? WALL_SNAP_CATEGORIES);
    const wallSnapped = repositionAgainstWalls(restyled, room, wallSnapCategories);
    // Once the desk has a final wall-snapped spot, pull its chair up to it —
    // otherwise the chair stays at its original scan position, orphaned from
    // a desk that just moved to a different wall.
    repositioned = scenario.pairChairWithDesk ? pairChairWithDesk(wallSnapped) : wallSnapped;
  }

  if (scenario.keepOffWindowWall) {
    repositioned = keepOffWindowWall(repositioned, room, new Set(scenario.keepOffWindowWall));
  }

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
    const { item, resolved } = resolveOverlapTowardCenter(extra, [...repositioned, ...placedExtras]);
    if (resolved || !scenario.optionalExtraIds?.includes(extra.id)) {
      placedExtras.push(item);
    }
  }
  const withExtras = [...repositioned, ...placedExtras];
  const windows = scenario.restyleWindow ? room.windows.map(scenario.restyleWindow) : room.windows;
  const walls = scenario.restyleWall ? room.walls.map(scenario.restyleWall) : room.walls;

  return { ...room, furniture: withExtras, windows, walls };
}

// Convenience used by /editor's "AI 추천 생성" handler (see
// EditorPlaceholder.tsx) to check whether the room's saved purpose/style has
// a matching scripted demo mood at all.
export function currentScenario(): Scenario | undefined {
  const purpose = safeStorageGet("local", "roomfit:selectedPurpose");
  const style = safeStorageGet("local", "roomfit:selectedStyle");
  if (purpose.status === "storage-error" || style.status === "storage-error") {
    console.warn("현재 시나리오 설정을 읽지 못해 기본 화면을 사용합니다.");
    return undefined;
  }
  return findScenario(
    purpose.status === "success" ? purpose.value : null,
    style.status === "success" ? style.value : null,
  );
}
