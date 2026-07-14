import { ContactShadows, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { FurnitureMesh } from "./FurnitureMesh";
import Door from "./Door";
import Floor from "./Floor";
import Lighting from "./Lighting";
import Wall from "./Wall";
import Window from "./Window";
import type { Furniture, RoomLayout, Vector2D, WallSegment } from "../../types";

interface RoomViewerProps {
  room: RoomLayout;
  furniture: Furniture[];
  selectedFurnitureId: string | null;
  onSelectFurniture: (id: string | null) => void;
  onMoveFurniture: (id: string, position: Vector2D) => void;
  onRotateFurniture?: (id: string) => void;
  hideEntranceWalls?: boolean;
  alignCameraToEntrance?: boolean;
  showEditingHelpers?: boolean;
}

export function RoomViewer({
  room,
  furniture,
  selectedFurnitureId,
  onSelectFurniture,
  onMoveFurniture,
  onRotateFurniture,
  hideEntranceWalls = false,
  alignCameraToEntrance = false,
  showEditingHelpers = false,
}: RoomViewerProps) {
  const camera = room.camera ?? {
    type: "orthographic" as const,
    position: { x: 6.2, y: 5.2, z: 6.2 },
    target: { x: 0, y: 0.6, z: 0 },
    zoom: 78,
  };
  const activeCamera = alignCameraToEntrance ? entranceViewCamera(room, camera) : camera;
  const cameraMode = alignCameraToEntrance ? `entrance-${room.id}` : `default-${room.id}`;

  return (
    <div className="viewer-shell">
      <Canvas
        shadows
        dpr={[1, 2]}
        // preserveDrawingBuffer keeps the last-rendered frame in the canvas's
        // backbuffer instead of it being cleared right after compositing —
        // without it, canvas.toDataURL() (see ManageFurniture.tsx's room
        // thumbnail capture) can grab a blank/black frame depending on
        // exactly when the browser decides to swap buffers relative to the
        // capture call.
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        onPointerMissed={() => onSelectFurniture(null)}
      >

        <group position={[0, -1, 0]}>
          {/* A warmer, clearly-distinct ivory — the walls are already a near-white
              "#f4f1ec", so a near-identical background made the room blend into
              its own backdrop instead of standing apart from it. */}
          <OrthographicCamera
            key={`camera-${cameraMode}`}
            makeDefault
            position={[activeCamera.position.x, activeCamera.position.y, activeCamera.position.z]}
            zoom={activeCamera.zoom}
            near={0.1}
            far={100}
          />
          <Lighting room={room} />

          <RoomShell room={room} hideEntranceWalls={hideEntranceWalls} />

          {furniture.map((item) => (
            <FurnitureMesh
              key={item.id}
              item={item}
              isSelected={selectedFurnitureId === item.id}
              canTransform={showEditingHelpers}
              showSelectionIndicator={showEditingHelpers}
              onSelect={onSelectFurniture}
              onMove={onMoveFurniture}
            />
          ))}

          <ContactShadows opacity={0.24} scale={8} blur={3.2} far={5} position={[0, 0.015, 0]} />
          <OrbitControls
            key={`controls-${cameraMode}`}
            makeDefault
            enableDamping
            target={[activeCamera.target.x, activeCamera.target.y, activeCamera.target.z]}
            minDistance={4.2}
            maxDistance={10}
            // Nearly top-down to nearly-horizontal — was locked to a narrow
            // 37.5°-85° band that made it impossible to look straight down into
            // the room (walls always blocked the view from any angle allowed).
            minPolarAngle={0.05}
            maxPolarAngle={1.5}
          />
        </group>
      </Canvas>
      <div className="viewer-caption">
        {showEditingHelpers && <span>가구를 클릭한 뒤 드래그해 이동할 수 있습니다.</span>}
        {showEditingHelpers && selectedFurnitureId && onRotateFurniture && (
          <button
            type="button"
            onClick={() => onRotateFurniture(selectedFurnitureId)}
            className="rounded-full bg-[#111111] px-3 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-[#333333]"
          >
            ⟳ 90° 회전
          </button>
        )}
        <strong>{showEditingHelpers && selectedFurnitureId ? "선택됨" : "둘러보기"}</strong>
      </div>
    </div>
  );
}

export default RoomViewer;

function RoomShell({ room, hideEntranceWalls }: { room: RoomLayout; hideEntranceWalls: boolean }) {
  const hiddenWallIds = hideEntranceWalls ? entranceViewWallIds(room) : new Set<string>();
  const visibleDoors = room.doors.filter((opening) => !opening.wallId || !hiddenWallIds.has(opening.wallId));
  const visibleWindows = room.windows.filter((opening) => !opening.wallId || !hiddenWallIds.has(opening.wallId));

  return (
    <group>
      <Floor room={room} />

      {room.walls.map((wall) => (
        hiddenWallIds.has(wall.id) ? null : <Wall key={wall.id} wall={wall} doors={visibleDoors} windows={visibleWindows} />
      ))}

      {visibleWindows.map((opening) => (
        <Window key={opening.id} opening={opening} wallHeight={room.height ?? 2.4} />
      ))}
      {visibleDoors.map((opening) => (
        <Door key={opening.id} opening={opening} wallThickness={wallThicknessFor(opening.wallId, room.walls)} />
      ))}
    </group>
  );
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

function entranceViewCamera(
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

// Falls back to the default wall thickness (matches Wall.tsx's own default)
// when an opening has no wallId (older/hand-authored data) or its wall
// somehow isn't found.
function wallThicknessFor(wallId: string | undefined, walls: WallSegment[]): number {
  return walls.find((wall) => wall.id === wallId)?.thickness ?? 0.12;
}
