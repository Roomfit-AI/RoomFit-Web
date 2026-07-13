import type { Furniture, RoomLayout } from "../types";

// Two fixed demo moods — purely additive on top of whatever furniture the
// user already saved in /manage-furniture. Never removes, recolors, or
// repositions an existing item; only appends a couple of new ones. Real
// per-item recommendation (driven by the /add-furniture catalog) isn't wired
// up anywhere in this app yet, so this is a scripted stand-in scoped to
// exactly the two moods the demo needs.
export interface Scenario {
  id: string;
  purpose: string;
  style: string;
  palette: string;
  // Stable ids for this scenario's furniture, checked against the room's
  // existing furniture before applying so re-entering /editor (or React
  // re-running the loading effect) never appends duplicates.
  itemIds: string[];
  // Which /add-furniture catalog items best match this mood, for a
  // consistent manage-furniture -> preference -> add-furniture -> editor
  // demo walkthrough.
  addFurnitureIds: string[];
  build: (room: RoomLayout) => Furniture[];
}

// Picks the `count` corners (inset from the walls by `margin`) that sit
// farthest from any existing furniture piece, so newly added items have the
// best chance of landing in genuinely open floor space without needing to
// know the specific room's layout ahead of time.
function findOpenCorners(room: RoomLayout, margin: number, count: number): { x: number; z: number }[] {
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
    // Nearest-neighbor distance to any existing piece — a corner that's far
    // from its single closest piece of furniture is far from all of them.
    score: room.furniture.reduce(
      (min, item) => Math.min(min, Math.hypot(item.position.x - corner.x, item.position.z - corner.z)),
      Infinity,
    ),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((entry) => entry.corner);
}

export const scenarios: Scenario[] = [
  {
    id: "rest-minimal-gray",
    purpose: "rest",
    style: "minimal",
    palette: "gray",
    itemIds: ["scenario-rest-chair", "scenario-rest-lamp"],
    addFurnitureIds: ["green-sofa", "floor-lamp"],
    build: (room) => {
      const [chairSpot, lampSpot] = findOpenCorners(room, 0.5, 2);

      return [
        {
          id: "scenario-rest-chair",
          name: "포인트 체어",
          category: "chair",
          geometry: "box",
          dimensions: { width: 0.62, depth: 0.62, height: 0.78 },
          position: chairSpot,
          rotationY: 0,
          color: "#c9c9c9",
          material: { type: "fabric", color: "#c9c9c9", roughness: 0.82, metalness: 0 },
          status: "recommended",
          removable: true,
        },
        {
          id: "scenario-rest-lamp",
          name: "플로어 스탠드",
          category: "lighting",
          geometry: "cylinder",
          dimensions: { width: 0.32, depth: 0.32, height: 1.55 },
          position: lampSpot,
          rotationY: 0,
          color: "#2b2b2b",
          material: { type: "metal", color: "#2b2b2b", roughness: 0.3, metalness: 0.7 },
          status: "recommended",
          removable: true,
        },
      ];
    },
  },
  {
    id: "work-natural-wood",
    purpose: "work",
    style: "natural",
    palette: "brown",
    itemIds: ["scenario-work-bookshelf", "scenario-work-plant-1", "scenario-work-plant-2"],
    addFurnitureIds: ["shelf-open", "plant"],
    build: (room) => {
      const [shelfSpot, plantSpot1, plantSpot2] = findOpenCorners(room, 0.4, 3);

      return [
        {
          id: "scenario-work-bookshelf",
          name: "우드 책장",
          category: "cabinet",
          geometry: "box",
          dimensions: { width: 0.7, depth: 0.32, height: 1.9 },
          position: shelfSpot,
          rotationY: 0,
          color: "#8b623a",
          material: { type: "wood", color: "#8b623a", roughness: 0.56, metalness: 0 },
          status: "recommended",
          removable: true,
        },
        {
          id: "scenario-work-plant-1",
          // Plant.tsx renders a floor-standing plant (scaled up, resting at
          // floor level) instead of a tabletop vase when the name includes
          // "바닥"/"플로어" — see that component for the mountHeight switch.
          name: "바닥 식물",
          category: "cabinet",
          geometry: "cylinder",
          dimensions: { width: 0.4, depth: 0.4, height: 0.9 },
          position: plantSpot1,
          rotationY: 0,
          color: "#5c6e46",
          material: { type: "accent", color: "#5c6e46", roughness: 0.8, metalness: 0 },
          status: "recommended",
          removable: true,
        },
        {
          id: "scenario-work-plant-2",
          name: "바닥 식물",
          category: "cabinet",
          geometry: "cylinder",
          dimensions: { width: 0.3, depth: 0.3, height: 0.6 },
          position: plantSpot2,
          rotationY: 0,
          color: "#6f7d54",
          material: { type: "accent", color: "#6f7d54", roughness: 0.8, metalness: 0 },
          status: "recommended",
          removable: true,
        },
      ];
    },
  },
];

export function findScenario(purpose: string | null, style: string | null): Scenario | undefined {
  return scenarios.find((scenario) => scenario.purpose === purpose && scenario.style === style);
}

// Additive only: returns `room` unchanged if no scenario matches, or if this
// scenario's items are already present (avoids appending duplicates if this
// runs more than once for the same room).
export function applyScenario(room: RoomLayout): RoomLayout {
  const purpose = localStorage.getItem("roomfit:selectedPurpose");
  const style = localStorage.getItem("roomfit:selectedStyle");
  const scenario = findScenario(purpose, style);

  if (!scenario) {
    return room;
  }

  const alreadyApplied = room.furniture.some((item) => scenario.itemIds.includes(item.id));
  if (alreadyApplied) {
    return room;
  }

  return {
    ...room,
    furniture: [...room.furniture, ...scenario.build(room)],
  };
}
