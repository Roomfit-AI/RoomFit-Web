import type { RoomLayout, Vector2D, WallSegment } from "../../types";

export function interiorViewWallIds(
  room: RoomLayout,
  cameraPosition: { x: number; z: number },
): Set<string> {
  const entranceWalls = entranceViewWallIds(room);
  if (entranceWalls.size > 0) {
    return entranceWalls;
  }

  return cameraFacingWallIds(room, cameraPosition);
}

export function entranceViewCamera(
  room: RoomLayout,
  baseCamera: NonNullable<RoomLayout["camera"]>,
): NonNullable<RoomLayout["camera"]> {
  const doorWall = doorWallFor(room);

  if (!doorWall) {
    return baseCamera;
  }

  const roomCenter = roomCenterOf(room);
  const hiddenDoorFaceIds = new Set<string>();
  addWallFace(hiddenDoorFaceIds, doorWall, room.walls);
  const leftWall = entranceLeftWallFor(room, doorWall, hiddenDoorFaceIds, roomCenter);
  const doorInward = inwardDirectionFor(doorWall, roomCenter);
  const leftInward = leftWall ? inwardDirectionFor(leftWall, roomCenter) : { x: 0, z: 0 };
  const viewX = doorInward.x + leftInward.x;
  const viewZ = doorInward.z + leftInward.z;
  const viewLength = Math.hypot(viewX, viewZ) || 1;
  const currentDistance = Math.hypot(baseCamera.position.x - baseCamera.target.x, baseCamera.position.z - baseCamera.target.z);
  const fallbackDistance = Math.hypot(room.width, room.depth) * 1.15;
  const distance = Math.max(currentDistance, fallbackDistance);
  const target = {
    x: roomCenter.x,
    y: baseCamera.target.y,
    z: roomCenter.z,
  };

  return {
    ...baseCamera,
    target,
    position: {
      x: target.x - (viewX / viewLength) * distance,
      y: baseCamera.position.y,
      z: target.z - (viewZ / viewLength) * distance,
    },
  };
}

function cameraFacingWallIds(
  room: RoomLayout,
  cameraPosition: { x: number; z: number },
): Set<string> {
  const roomCenter = roomCenterOf(room);
  const viewDirection = {
    x: cameraPosition.x - roomCenter.x,
    z: cameraPosition.z - roomCenter.z,
  };
  const candidates = room.walls
    .map((wall) => {
      const center = wallCenter(wall);
      return {
        wall,
        score:
          (center.x - roomCenter.x) * viewDirection.x +
          (center.z - roomCenter.z) * viewDirection.z,
      };
    })
    .sort((a, b) => b.score - a.score);
  const hiddenWallIds = new Set<string>();
  const first = candidates[0]?.wall;

  if (!first) {
    return hiddenWallIds;
  }

  addWallFace(hiddenWallIds, first, room.walls);
  const second = candidates.find(({ wall }) => !hiddenWallIds.has(wall.id) && !wallsAreParallel(first, wall));
  if (second) {
    addWallFace(hiddenWallIds, second.wall, room.walls);
  }

  return hiddenWallIds;
}

function wallsAreParallel(a: WallSegment, b: WallSegment): boolean {
  const aDx = a.end.x - a.start.x;
  const aDz = a.end.z - a.start.z;
  const bDx = b.end.x - b.start.x;
  const bDz = b.end.z - b.start.z;
  const aLength = Math.hypot(aDx, aDz);
  const bLength = Math.hypot(bDx, bDz);

  if (aLength <= 0.01 || bLength <= 0.01) {
    return false;
  }

  const dot = Math.abs((aDx / aLength) * (bDx / bLength) + (aDz / aLength) * (bDz / bLength));
  return dot >= 0.98;
}

function entranceViewWallIds(room: RoomLayout) {
  const doorWall = doorWallFor(room);
  const hiddenWallIds = new Set<string>();

  if (!doorWall) {
    return hiddenWallIds;
  }

  addWallFace(hiddenWallIds, doorWall, room.walls);

  const roomCenter = roomCenterOf(room);
  const leftWall = entranceLeftWallFor(room, doorWall, hiddenWallIds, roomCenter);

  if (leftWall) {
    addWallFace(hiddenWallIds, leftWall, room.walls);
  }

  return hiddenWallIds;
}

function entranceLeftWallFor(
  room: RoomLayout,
  doorWall: WallSegment,
  hiddenWallIds: Set<string>,
  roomCenter: Vector2D,
) {
  const inward = inwardDirectionFor(doorWall, roomCenter);
  const leftX = inward.z;
  const leftZ = -inward.x;

  let leftWall: WallSegment | null = null;
  let bestLeftScore = 0.05;

  for (const wall of room.walls) {
    if (hiddenWallIds.has(wall.id)) {
      continue;
    }

    const center = wallCenter(wall);
    const score = (center.x - roomCenter.x) * leftX + (center.z - roomCenter.z) * leftZ;

    if (score > bestLeftScore) {
      bestLeftScore = score;
      leftWall = wall;
    }
  }

  return leftWall;
}

function inwardDirectionFor(wall: WallSegment, roomCenter: Vector2D): Vector2D {
  const center = wallCenter(wall);
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const length = Math.hypot(dx, dz) || 1;
  const normalA = { x: -dz / length, z: dx / length };
  const towardCenter = {
    x: roomCenter.x - center.x,
    z: roomCenter.z - center.z,
  };
  const facesCenter = normalA.x * towardCenter.x + normalA.z * towardCenter.z >= 0;

  return facesCenter ? normalA : { x: -normalA.x, z: -normalA.z };
}

function addWallFace(target: Set<string>, seedWall: WallSegment, walls: WallSegment[]) {
  for (const wall of walls) {
    if (isSameWallFace(seedWall, wall)) {
      target.add(wall.id);
    }
  }
}

function isSameWallFace(a: WallSegment, b: WallSegment) {
  const aDx = a.end.x - a.start.x;
  const aDz = a.end.z - a.start.z;
  const bDx = b.end.x - b.start.x;
  const bDz = b.end.z - b.start.z;
  const aLength = Math.hypot(aDx, aDz);
  const bLength = Math.hypot(bDx, bDz);

  if (aLength <= 0.01 || bLength <= 0.01) {
    return a.id === b.id;
  }

  const dot = Math.abs((aDx / aLength) * (bDx / bLength) + (aDz / aLength) * (bDz / bLength));
  if (dot < 0.98) {
    return false;
  }

  const startDistance = distanceToInfiniteWallLine(b.start, a);
  const endDistance = distanceToInfiniteWallLine(b.end, a);

  return startDistance < 0.18 && endDistance < 0.18;
}

function distanceToInfiniteWallLine(position: Vector2D, wall: WallSegment) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const length = Math.hypot(dx, dz);

  if (length <= 0.0001) {
    return Math.hypot(position.x - wall.start.x, position.z - wall.start.z);
  }

  return Math.abs((position.x - wall.start.x) * dz - (position.z - wall.start.z) * dx) / length;
}

function doorWallFor(room: RoomLayout) {
  const door = room.doors[0];

  if (!door) {
    return null;
  }

  if (door.wallId) {
    const explicitWall = room.walls.find((wall) => wall.id === door.wallId);
    if (explicitWall) {
      return explicitWall;
    }
  }

  return nearestWallTo(door.position, room.walls);
}

function nearestWallTo(position: Vector2D, walls: WallSegment[]) {
  let nearestWall: WallSegment | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const wall of walls) {
    const distance = distanceToWallSegment(position, wall);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestWall = wall;
    }
  }

  return nearestWall;
}

function distanceToWallSegment(position: Vector2D, wall: WallSegment) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const lengthSquared = dx * dx + dz * dz;

  if (lengthSquared <= 0.0001) {
    return Math.hypot(position.x - wall.start.x, position.z - wall.start.z);
  }

  const rawT = ((position.x - wall.start.x) * dx + (position.z - wall.start.z) * dz) / lengthSquared;
  const t = Math.min(1, Math.max(0, rawT));
  const closestX = wall.start.x + dx * t;
  const closestZ = wall.start.z + dz * t;

  return Math.hypot(position.x - closestX, position.z - closestZ);
}

function roomCenterOf(room: RoomLayout): Vector2D {
  if (room.walls.length === 0) {
    return { x: 0, z: 0 };
  }

  let x = 0;
  let z = 0;

  for (const wall of room.walls) {
    x += wall.start.x + wall.end.x;
    z += wall.start.z + wall.end.z;
  }

  return {
    x: x / (room.walls.length * 2),
    z: z / (room.walls.length * 2),
  };
}

function wallCenter(wall: WallSegment): Vector2D {
  return {
    x: (wall.start.x + wall.end.x) / 2,
    z: (wall.start.z + wall.end.z) / 2,
  };
}
