import type { LayoutValidationResult, ScoreSummary } from "../api/layouts";
import { footprint, footprintsOverlap } from "./scenarios";
import type { Opening, RoomLayout } from "../types";

// A minimal local stand-in for the backend's layout validator/scorer (see
// api/layouts.ts's recommendLayout/applyLayoutFeedback), used for rooms whose
// "AI 추천 생성"/피드백 took the scripted-scenario or local-feedback shortcut
// (see EditorPlaceholder.tsx) instead of a real backend round trip — there's
// no backend response to read scoreSummary/validationResult off of in that
// case, so without this the "배치 점수"/"검증 결과" panels would just never
// render for a scripted-scenario room. This only checks what's cheap to check
// from furniture geometry alone (collisions, room-boundary containment,
// door/window clearance) — pathSecured/goalScore/styleScore need real
// pathfinding or the backend's own scoring rules, so those stay fixed,
// clearly-approximate "looks fine" values rather than pretending to compute
// them.
const CLEARANCE = 0.55;

function isWithinBounds(item: { x0: number; x1: number; z0: number; z1: number }, room: RoomLayout): boolean {
  const halfWidth = room.width / 2;
  const halfDepth = room.depth / 2;
  return item.x0 >= -halfWidth - 0.01 && item.x1 <= halfWidth + 0.01 && item.z0 >= -halfDepth - 0.01 && item.z1 <= halfDepth + 0.01;
}

function hasClearance(opening: Opening, room: RoomLayout): boolean {
  return !room.furniture.some((item) => {
    const fp = footprint(item);
    const dx = Math.max(fp.x0 - opening.position.x, 0, opening.position.x - fp.x1);
    const dz = Math.max(fp.z0 - opening.position.z, 0, opening.position.z - fp.z1);
    return Math.hypot(dx, dz) < CLEARANCE;
  });
}

export function buildLocalValidation(room: RoomLayout): { scoreSummary: ScoreSummary; validationResult: LayoutValidationResult } {
  const furniture = room.furniture;
  const warnings: string[] = [];

  const collisions = furniture.flatMap((item, index) =>
    furniture.slice(index + 1).some((other) => item.category !== "rug" && other.category !== "rug" && footprintsOverlap(item, other))
      ? [item]
      : [],
  );
  const collisionFree = collisions.length === 0;
  if (!collisionFree) {
    warnings.push(`${collisions.map((item) => item.name).join(", ")} 가구가 다른 가구와 겹쳐 있습니다.`);
  }

  const outOfBounds = furniture.filter((item) => !isWithinBounds(footprint(item), room));
  const boundaryValid = outOfBounds.length === 0;
  if (!boundaryValid) {
    warnings.push(`${outOfBounds.map((item) => item.name).join(", ")} 가구가 방 경계를 벗어났습니다.`);
  }

  const doorClearance = room.doors.every((door) => hasClearance(door, room));
  if (!doorClearance) {
    warnings.push("문 앞 공간이 가구로 막혀 있습니다.");
  }

  const windowClearance = room.windows.every((window) => hasClearance(window, room));
  if (!windowClearance) {
    warnings.push("창문 앞 공간이 가구로 막혀 있습니다.");
  }

  // No local pathfinding — approximated as secured whenever nothing else is
  // wrong, since a room with no collisions/boundary issues and clear
  // doors/windows is the overwhelming common case for a passable layout.
  const pathSecured = collisionFree && boundaryValid;

  const collisionScore = collisionFree ? 100 : Math.max(40, 100 - collisions.length * 20);
  const boundaryScore = boundaryValid ? 100 : Math.max(40, 100 - outOfBounds.length * 20);
  const doorWindowScore = doorClearance && windowClearance ? 95 : 60;
  const pathScore = pathSecured ? 92 : 55;
  // No local equivalent of the backend's goal/style matching (that's rule-
  // based scoring against the user's saved preference/inspiration picks) —
  // fixed at a reasonable "on-theme" value since the scripted scenario was
  // itself picked to match the room's saved purpose/style.
  const goalScore = 90;
  const styleScore = 90;
  const totalScore = Math.round((collisionScore + boundaryScore + doorWindowScore + pathScore + goalScore + styleScore) / 6);

  return {
    scoreSummary: { collisionScore, boundaryScore, doorWindowScore, pathScore, goalScore, styleScore, totalScore },
    validationResult: { collisionFree, boundaryValid, doorClearance, windowClearance, pathSecured, warnings },
  };
}
