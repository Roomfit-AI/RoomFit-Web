import type { RoomLayout } from "../types";

export const sampleRoom: RoomLayout = {
  id: "modern-studio-preview",
  name: "모던 원룸",
  description: "따뜻한 우드 블라인드와 화이트 패브릭 가구가 있는 원룸 프리뷰",
  width: 6.4,
  depth: 4.8,
  floor: {
    size: {
      width: 6.4,
      depth: 4.8,
    },
    material: {
      color: "#c2996a",
      roughness: 0.68,
    },
  },
  camera: {
    type: "orthographic",
    position: {
      x: 6.4,
      y: 5.2,
      z: 6.2,
    },
    target: {
      x: 0.25,
      y: 0.7,
      z: -0.15,
    },
    zoom: 82,
  },
  lighting: {
    ambient: 0.78,
    sun: {
      intensity: 1.95,
      position: [3.8, 7.5, 4.6],
    },
    environment: "bright-neutral-studio",
  },
  walls: [
    {
      id: "back-wall",
      start: { x: -3.2, z: -2.4 },
      end: { x: 3.2, z: -2.4 },
      height: 2.9,
      thickness: 0.12,
      material: {
        color: "#f6f3ee",
        roughness: 0.82,
      },
    },
    {
      id: "right-wall",
      start: { x: 3.2, z: -2.4 },
      end: { x: 3.2, z: 2.4 },
      height: 2.9,
      thickness: 0.14,
      material: {
        color: "#f4f0ea",
        roughness: 0.84,
      },
    },
  ],
  doors: [],
  windows: [
    {
      id: "preview-window",
      label: "창문",
      // 3.35m -> 2.0m (too small) -> 2.6m -> 3.0m. Left edge at this width
      // (1.15 - 1.5 = -0.35) still clears the TV/stand cluster's right edge
      // (-0.65) with room to spare, and the right edge (2.65) stays clear of
      // the north-east corner.
      position: { x: -2.0, z: -2.34 },
      dimensions: { width: 1.5, depth: 0.18, height: 1.55 },
      rotationY: 0,
      frame: {
        color: "#8a623d",
      },
      glass: {
        transmission: 0.28,
        opacity: 0.24,
      },
      blind: {
        enabled: true,
        type: "wood",
        slats: 18,
      },
    },
  ],
  furniture: [
    {
      id: "preview-tv",
      name: "벽걸이 TV",
      category: "cabinet",
      geometry: "box",
      // height: 1.8 (doubled from the original 0.9 per an earlier request)
      // made the visible screen almost square (~1.15:1) once the stand
      // clearance was subtracted — 1.3 gets the actual panel back to a
      // proper ~16:9 widescreen rectangle (see Television.tsx's
      // standClearance math for how the panel height is derived).
      dimensions: { width: 1.55, depth: 0.08, height: 1.3 },
      // Swapped with the small bookshelf's old spot (moved to x: -2.4, the
      // corner this TV used to sit in) so the TV reads as pulled in from the
      // corner rather than jammed against it. Not the bookshelf's exact old
      // x (-0.65) — the window spans roughly x: -0.53..2.81 on this same
      // wall, and at the TV's own width that would overlap the window frame;
      // -1.4 is far enough west of it to clear.
      position: { x: 1.15, z: -2.3 },
      rotationY: 0,
      color: "#101010",
      material: {
        type: "glass",
        color: "#101010",
        roughness: 0.08,
        metalness: 0.18,
      },
      status: "existing",
      removable: true,
    },
    {
      id: "preview-tv-stand",
      name: "TV 장식장",
      category: "cabinet",
      geometry: "rounded-box",
      // Was 1.8m wide at x: -2.4 — half-width (0.9) pushed its west edge to
      // -3.3, past the room's -3.2 boundary (no west wall there to visually
      // hide it behind, so it read as poking out of the room). Narrowed so it
      // fully clears the floor with a small margin.
      dimensions: { width: 1.5, depth: 0.36, height: 0.28 },
      // Flush against the back wall's inner face, same x as the TV above it.
      position: { x: 1.15, z: -2.16 },
      rotationY: 0,
      color: "#8a6847",
      material: {
        type: "wood",
        color: "#8a6847",
        roughness: 0.55,
        metalness: 0,
      },
      status: "existing",
      removable: true,
    },
    {
      // Not "...tv..." — FurnitureRenderer's Television check matches on
      // `${id} ${name}`.includes("tv") && !includes("stand"), and this id
      // would otherwise satisfy that before ever reaching the "선반" check.
      id: "preview-wall-decor-shelf",
      name: "플로팅 선반",
      category: "cabinet",
      geometry: "box",
      // Same x/z as the TV below it. Height is the shelf's own honest
      // thickness-plus-decor footprint (see FloatingShelf.tsx for how it
      // re-anchors to a fixed wall-mount height instead of floor height/2).
      dimensions: { width: 1.1, depth: 0.18, height: 0.3 },
      position: { x: 1.15, z: -2.3 },
      rotationY: 0,
      color: "#8a623d",
      material: {
        type: "wood",
        color: "#8a623d",
        roughness: 0.55,
        metalness: 0,
      },
      status: "existing",
      removable: true,
    },
    {
      id: "preview-bookshelf",
      name: "우드 책장",
      category: "cabinet",
      geometry: "box",
      dimensions: { width: 0.58, depth: 0.42, height: 1.72 },
      // Pushed almost flush against the room's west edge (floor spans to
      // x: -3.2; there's no actual west wall in this room's data, only
      // north/east, so this is as close to "against the left wall" as the
      // floor boundary allows).
      position: { x: -0.5, z: -2.0 },
      rotationY: 0,
      color: "#8b623a",
      material: {
        type: "wood",
        color: "#8b623a",
        roughness: 0.56,
        metalness: 0,
      },
      status: "existing",
      removable: true,
    },
    {
      id: "preview-lounge-chair",
      name: "라운지 소파",
      category: "chair",
      geometry: "rounded-box",
      dimensions: { width: 1.34, depth: 0.95, height: 0.72 },
      // Back on the rug's west portion, facing east toward the coffee
      // table — pulled far enough from the 3-seat sofa (z: 1.55, front edge
      // z: 1.1) to leave a clear ~0.23m gap instead of the two nearly
      // touching.
      position: { x: -0.85, z: 0.2 },
      rotationY: Math.PI / 2,
      // Same dark modern family as the sofa, one notch warmer so the two
      // don't read as identical twins.
      color: "#2a2622",
      material: {
        type: "fabric",
        color: "#2a2622",
        roughness: 0.4,
        metalness: 0,
      },
      status: "existing",
      removable: true,
    },
    {
      id: "preview-sofa",
      name: "3인 소파",
      category: "chair",
      geometry: "rounded-box",
      dimensions: { width: 2.85, depth: 0.9, height: 0.76 },
      // Anchored to the rug's south edge, facing north toward the coffee
      // table/rug center — part of a loose conversational arc with the
      // lounge chair on the rug's west edge, instead of two pieces of
      // seating that happened to sit near the same rug by coincidence.
      position: { x: 0.45, z: 1.55 },
      rotationY: Math.PI,
      // Modern leather look — a cool graphite rather than flat black, so it
      // reads as a considered charcoal instead of a featureless dark mass.
      // Warm terracotta cushions (see Sofa.tsx) play off the wood floor and
      // give it real color contrast instead of staying monochrome.
      color: "#33383c",
      material: {
        type: "fabric",
        color: "#33383c",
        roughness: 0.4,
        metalness: 0.08,
      },
      status: "existing",
      removable: true,
    },
    {
      id: "preview-rug",
      name: "베이지 러그",
      category: "rug",
      geometry: "plane",
      dimensions: { width: 3.2, depth: 2.05, height: 0.035 },
      position: { x: 0.45, z: 0.55 },
      rotationY: 0,
      color: "#d6c9b7",
      material: {
        type: "fabric",
        color: "#d6c9b7",
        roughness: 0.96,
        metalness: 0,
      },
      status: "existing",
      removable: true,
    },
    {
      id: "preview-table",
      name: "원형 커피테이블",
      category: "desk",
      geometry: "cylinder",
      dimensions: { width: 0.92, depth: 0.92, height: 0.42 },
      // Centered on the rug (x matches its 0.45 center) and roughly equidistant
      // between the sofa (z: 1.55) and lounge chair (z: 0.2) — was pulled hard
      // toward the chair's side (x: 0.15) instead of sitting between the two.
      position: { x: 0.45, z: 0.4 },
      rotationY: 0,
      color: "#a57545",
      material: {
        type: "wood",
        color: "#a57545",
        roughness: 0.55,
        metalness: 0,
      },
      status: "existing",
      removable: true,
    },
    {
      id: "preview-floor-lamp",
      name: "플로어 조명",
      category: "lighting",
      geometry: "cylinder",
      dimensions: { width: 0.35, depth: 0.35, height: 1.85 },
      position: { x: 2.25, z: -1.5 },
      rotationY: -0.28,
      color: "#26211d",
      material: {
        type: "metal",
        color: "#26211d",
        roughness: 0.25,
        metalness: 0.8,
      },
      status: "existing",
      removable: true,
    },
    {
      id: "preview-plant",
      name: "테이블 화병",
      category: "cabinet",
      geometry: "cylinder",
      dimensions: { width: 0.28, depth: 0.28, height: 0.48 },
      // Keeps the same offset from the coffee table's center as before, now
      // that the table itself moved.
      position: { x: 0.4, z: 0.37 },
      rotationY: 0,
      color: "#6f7d54",
      material: {
        type: "accent",
        color: "#6f7d54",
        roughness: 0.8,
        metalness: 0,
      },
      status: "existing",
      removable: true,
    },
    {
      id: "preview-east-bookshelf",
      name: "우드 책장",
      category: "cabinet",
      geometry: "box",
      // Replaces the old flat WoodTrim decor panel that used to run almost
      // the full depth of the east wall — a real bookshelf piece instead of
      // an unlabeled slab of wood, sized to fill the wall the same way.
      dimensions: { width: 4.2, depth: 0.32, height: 2.0 },
      // Flush against the east ("right-wall") wall, centered along it,
      // facing west into the room.
      position: { x: 2.97, z: 0 },
      rotationY: -Math.PI / 2,
      color: "#8b623a",
      material: {
        type: "wood",
        color: "#8b623a",
        roughness: 0.56,
        metalness: 0,
      },
      status: "existing",
      removable: true,
    },
  ],
};