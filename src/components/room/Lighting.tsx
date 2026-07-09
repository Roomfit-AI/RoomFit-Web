import type { RoomLayout } from "../../types";

export default function Lighting({ room }: { room: RoomLayout }) {
  const ambient = room.lighting?.ambient ?? 0.82;
  const sunPosition = room.lighting?.sun.position ?? [3.6, 7.2, 4.4];
  const sunIntensity = room.lighting?.sun.intensity ?? 1.85;

  return (
    <>
      <ambientLight intensity={ambient} />
      <directionalLight
        castShadow
        position={sunPosition}
        intensity={sunIntensity}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={24}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[-4, 4, -3]} intensity={0.38} />
      <hemisphereLight args={["#fff8ee", "#d8caba", room.lighting?.environment ? 0.62 : 0.5]} />
    </>
  );
}
