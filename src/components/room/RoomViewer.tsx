import { ContactShadows, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { FurnitureMesh } from "./FurnitureMesh";
import Door from "./Door";
import Floor from "./Floor";
import Lighting from "./Lighting";
import Wall from "./Wall";
import Window from "./Window";
import Material from "../materials/Material";
import type { Furniture, RoomLayout, Vector2D, WallSegment } from "../../types";

interface RoomViewerProps {
  room: RoomLayout;
  furniture: Furniture[];
  selectedFurnitureId: string | null;
  onSelectFurniture: (id: string | null) => void;
  onMoveFurniture: (id: string, position: Vector2D) => void;
  onRotateFurniture?: (id: string) => void;
}

export function RoomViewer({
  room,
  furniture,
  selectedFurnitureId,
  onSelectFurniture,
  onMoveFurniture,
  onRotateFurniture,
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
        {/* A warmer, clearly-distinct ivory — the walls are already a near-white
            "#f4f1ec", so a near-identical background made the room blend into
            its own backdrop instead of standing apart from it. */}
        <color attach="background" args={["#efe6d3"]} />
        <OrthographicCamera
          makeDefault
          position={[camera.position.x, camera.position.y, camera.position.z]}
          zoom={camera.zoom}
          near={0.1}
          far={100}
        />
        <Lighting room={room} />

        <RoomShell room={room} />

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

function RoomShell({ room }: { room: RoomLayout }) {
  // The marble/wood decor panels below are a fixed styling flourish sized for
  // the original sample studio layout — on a real scanned room they don't
  // correspond to anything real, and were physically covering the real window
  // on the east wall. Only show them for sample/demo rooms.
  const isRealScan = room.source === "ROOMPLAN";

  return (
    <group>
      <Floor room={room} />

      {room.walls.map((wall) => (
        <Wall key={wall.id} wall={wall} doors={room.doors} windows={room.windows} />
      ))}

      {!isRealScan && <DecorWall room={room} />}
      {room.windows.map((opening) => (
        <Window key={opening.id} opening={opening} wallHeight={room.height ?? 2.4} />
      ))}
      {room.doors.map((opening) => (
        <Door key={opening.id} opening={opening} wallThickness={wallThicknessFor(opening.wallId, room.walls)} />
      ))}
    </group>
  );
}

// Falls back to the default wall thickness (matches Wall.tsx's own default)
// when an opening has no wallId (older/hand-authored data) or its wall
// somehow isn't found.
function wallThicknessFor(wallId: string | undefined, walls: WallSegment[]): number {
  return walls.find((wall) => wall.id === wallId)?.thickness ?? 0.12;
}

function DecorWall({ room }: { room: RoomLayout }) {
  return (
    <group>
      <MarblePanel position={[-room.width / 2 + 0.8, 1.1, -room.depth / 2 + 0.07]} />
      <WoodTrim position={[room.width / 2 - 0.07, 1.45, -0.25]} depth={room.depth - 0.45} />
    </group>
  );
}

function MarblePanel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.85, 1.35, 0.055]} />
        <Material type="white" color="#e9e4dc" roughness={0.72} />
      </mesh>
      {[-0.55, 0.05, 0.55].map((offset, index) => (
        <mesh key={index} position={[offset, 0, 0.032]} rotation={[0, 0, -0.55 + index * 0.24]}>
          <boxGeometry args={[0.018, 1.55, 0.012]} />
          <meshBasicMaterial color="#d2cbc1" transparent opacity={0.46} />
        </mesh>
      ))}
    </group>
  );
}

function WoodTrim({ position, depth }: { position: [number, number, number]; depth: number }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.12, 2.9, depth]} />
        <Material type="wood" color="#8a623d" roughness={0.55} />
      </mesh>
    </group>
  );
}
