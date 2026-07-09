import { ContactShadows, Grid, OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { FurnitureMesh } from "./FurnitureMesh";
import type { Furniture, RoomLayout, Vector2D, WallSegment } from "../../types";

interface RoomViewerProps {
  room: RoomLayout;
  furniture: Furniture[];
  selectedFurnitureId: string | null;
  onSelectFurniture: (id: string | null) => void;
  onMoveFurniture: (id: string, position: Vector2D) => void;
}

export function RoomViewer({
  room,
  furniture,
  selectedFurnitureId,
  onSelectFurniture,
  onMoveFurniture,
}: RoomViewerProps) {
  return (
    <div className="viewer-shell">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onPointerMissed={() => onSelectFurniture(null)}
      >
        <color attach="background" args={["#f8fafc"]} />
        <PerspectiveCamera makeDefault position={[4.7, 5.1, 5.4]} fov={44} />
        <ambientLight intensity={0.72} />
        <directionalLight
          castShadow
          position={[2.5, 6, 3.8]}
          intensity={1.15}
          shadow-mapSize={[2048, 2048]}
        />

        <RoomShell room={room} />
        {furniture.map((item) => (
          <FurnitureMesh
            key={item.id}
            item={item}
            isSelected={selectedFurnitureId === item.id}
            canTransform={item.category === "desk"}
            onSelect={onSelectFurniture}
            onMove={onMoveFurniture}
          />
        ))}

        <Grid
          position={[0, 0.006, 0]}
          args={[8, 8]}
          cellSize={0.5}
          cellThickness={0.45}
          cellColor="#d4d4d8"
          sectionSize={1}
          sectionThickness={0.8}
          sectionColor="#a1a1aa"
          fadeDistance={9}
          fadeStrength={1.3}
          infiniteGrid={false}
        />
        <ContactShadows opacity={0.22} scale={8} blur={2.4} far={4} position={[0, 0.01, 0]} />
        <OrbitControls makeDefault enableDamping minDistance={3.8} maxDistance={9} maxPolarAngle={Math.PI / 2.08} />
      </Canvas>
      <div className="viewer-caption">
        <span>가구를 클릭한 뒤 화살표를 드래그해 이동할 수 있습니다.</span>
        <strong>{selectedFurnitureId ? "선택됨" : "둘러보기"}</strong>
      </div>
    </div>
  );
}

function RoomShell({ room }: { room: RoomLayout }) {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.015, 0]}>
        <boxGeometry args={[room.width, 0.03, room.depth]} />
        <meshStandardMaterial color="#ffffff" roughness={0.82} />
      </mesh>

      {room.walls.map((wall) => (
        <Wall key={wall.id} wall={wall} />
      ))}

      <OpeningMarker
        label="Door"
        position={[room.door.position.x, 0.04, room.door.position.z]}
        size={[room.door.dimensions.width, 0.035, 0.28]}
        color="#111827"
      />
      <OpeningMarker
        label="Window"
        position={[room.window.position.x, 1.05, room.window.position.z]}
        size={[room.window.dimensions.width, 0.08, 0.05]}
        color="#7dd3fc"
      />

      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[1.1, 0.018, room.depth - 1.1]} />
        <meshBasicMaterial color="#fef3c7" transparent opacity={0.24} />
      </mesh>
    </group>
  );
}

function Wall({ wall }: { wall: WallSegment }) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const centerX = (wall.start.x + wall.end.x) / 2;
  const centerZ = (wall.start.z + wall.end.z) / 2;

  return (
    <mesh castShadow receiveShadow position={[centerX, 0.34, centerZ]} rotation={[0, -angle, 0]}>
      <boxGeometry args={[length, 0.68, 0.08]} />
      <meshStandardMaterial color="#e4e4e7" roughness={0.78} />
    </mesh>
  );
}

interface OpeningMarkerProps {
  label: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}

function OpeningMarker({ label, position, size, color }: OpeningMarkerProps) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <Text
        position={[0, 0.18, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.13}
        color="#27272a"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}
