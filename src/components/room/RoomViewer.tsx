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
  hideForegroundWalls?: boolean;
}

export function RoomViewer({
  room,
  furniture,
  selectedFurnitureId,
  onSelectFurniture,
  onMoveFurniture,
  onRotateFurniture,
  hideForegroundWalls = false,
}: RoomViewerProps) {
  const camera = room.camera ?? {
    type: "orthographic" as const,
    position: { x: 6.2, y: 5.2, z: 6.2 },
    target: { x: 0, y: 0.6, z: 0 },
    zoom: 78,
  };

  return (
    <div className="viewer-shell">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
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
            makeDefault
            position={[camera.position.x, camera.position.y, camera.position.z]}
            zoom={camera.zoom}
            near={0.1}
            far={100}
          />
          <Lighting room={room} />

          <RoomShell room={room} hideForegroundWalls={hideForegroundWalls} />

          {furniture.map((item) => (
            <FurnitureMesh
              key={item.id}
              item={item}
              isSelected={selectedFurnitureId === item.id}
              canTransform
              onSelect={onSelectFurniture}
              onMove={onMoveFurniture}
            />
          ))}

          <ContactShadows opacity={0.24} scale={8} blur={3.2} far={5} position={[0, 0.015, 0]} />
          <OrbitControls
            makeDefault
            enableDamping
            target={[camera.target.x, camera.target.y, camera.target.z]}
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
        <span>가구를 클릭한 뒤 드래그해 이동할 수 있습니다.</span>
        {selectedFurnitureId && onRotateFurniture && (
          <button
            type="button"
            onClick={() => onRotateFurniture(selectedFurnitureId)}
            className="rounded-full bg-[#111111] px-3 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-[#333333]"
          >
            ⟳ 90° 회전
          </button>
        )}
        <strong>{selectedFurnitureId ? "선택됨" : "둘러보기"}</strong>
      </div>
    </div>
  );
}

export default RoomViewer;

function RoomShell({ room, hideForegroundWalls }: { room: RoomLayout; hideForegroundWalls: boolean }) {
  const hiddenWallIds = hideForegroundWalls ? foregroundWallIds(room) : new Set<string>();
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

function foregroundWallIds(room: RoomLayout) {
  const camera = room.camera ?? {
    position: { x: 6.2, y: 5.2, z: 6.2 },
    target: { x: 0, y: 0.6, z: 0 },
  };
  const viewX = camera.position.x - camera.target.x;
  const viewZ = camera.position.z - camera.target.z;
  const viewLength = Math.hypot(viewX, viewZ) || 1;
  const dirX = viewX / viewLength;
  const dirZ = viewZ / viewLength;
  const roomCenterX = camera.target.x;
  const roomCenterZ = camera.target.z;

  return new Set(
    room.walls
      .filter((wall) => {
        const centerX = (wall.start.x + wall.end.x) / 2;
        const centerZ = (wall.start.z + wall.end.z) / 2;
        const towardCamera = (centerX - roomCenterX) * dirX + (centerZ - roomCenterZ) * dirZ;

        return towardCamera > 0.25;
      })
      .map((wall) => wall.id),
  );
}

// Falls back to the default wall thickness (matches Wall.tsx's own default)
// when an opening has no wallId (older/hand-authored data) or its wall
// somehow isn't found.
function wallThicknessFor(wallId: string | undefined, walls: WallSegment[]): number {
  return walls.find((wall) => wall.id === wallId)?.thickness ?? 0.12;
}

