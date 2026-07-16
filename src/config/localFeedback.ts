import type { InterpretedIntent } from "../api/layouts";
import type { Furniture, FurnitureCategory, RoomLayout } from "../types";

// A minimal, local stand-in for the backend's LLM-interpreted feedback loop
// (see api/layouts.ts's applyLayoutFeedback), used only when "AI 추천 생성"
// took the scripted-scenario shortcut in EditorPlaceholder.tsx instead of a
// real backend layoutId — there is no server-side layout to send feedback
// to, so this handles the one thing the demo actually needs: "make <가구>
// bigger/smaller," entirely client-side. It is not a general NLU layer — a
// feedback string that doesn't name a known category and a grow/shrink cue
// is rejected rather than guessed at.
interface CategoryMatch {
  category: FurnitureCategory;
  label: string;
}

const CATEGORY_KEYWORDS: Array<{ category: FurnitureCategory; label: string; keywords: string[] }> = [
  { category: "desk", label: "책상", keywords: ["책상", "데스크"] },
  { category: "bed", label: "침대", keywords: ["침대", "베드"] },
  { category: "chair", label: "의자", keywords: ["의자", "체어", "소파"] },
  { category: "cabinet", label: "수납장", keywords: ["수납장", "책장", "옷장", "선반", "수납"] },
  { category: "rug", label: "러그", keywords: ["러그", "카펫"] },
];

const SHRINK_WORDS = ["좁게", "좁히", "작게", "줄이", "줄여", "축소"];
const WIDTH_WORDS = ["가로", "폭"];
const DEPTH_WORDS = ["세로", "깊이"];

// A scripted special case for the 네츄럴 톤 (rest-natural-wood) demo only —
// "더 큰 책상으로 교체해줘" style requests read as wanting an actual
// *different* desk, not just a bigger version of the same one, so this
// swaps in both a bigger width and a fresh look instead of just nudging the
// existing size like the generic grow/shrink path below does. This is a
// scripted demo stand-in, not a general "replace this furniture" feature.
const DESK_REPLACEMENT_VERBS = ["교체", "바꿔", "바꾸", "다른"];

function isDeskReplacementRequest(feedback: string): boolean {
  return feedback.includes("책상") && DESK_REPLACEMENT_VERBS.some((word) => feedback.includes(word));
}

// Per-request step and sane per-category min/max — this never does real
// collision/footprint checking against the room (that's what the backend's
// validation pass is for), just keeps a repeatedly-applied "넓게" from
// growing a desk to absurd size.
const STEP = 0.18;
const SIZE_BOUNDS: Partial<Record<FurnitureCategory, { width: [number, number]; depth: [number, number] }>> = {
  desk: { width: [0.5, 2.0], depth: [0.4, 1.1] },
  bed: { width: [0.9, 2.2], depth: [1.6, 2.2] },
  chair: { width: [0.4, 1.6], depth: [0.4, 1.0] },
  cabinet: { width: [0.35, 1.8], depth: [0.3, 0.7] },
  rug: { width: [0.8, 5], depth: [0.8, 5] },
};

function matchCategory(feedback: string): CategoryMatch | null {
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some((word) => feedback.includes(word))) {
      return { category: entry.category, label: entry.label };
    }
  }
  return null;
}

function directionMultiplier(feedback: string): 1 | -1 {
  // No explicit shrink cue defaults to "grow" — "더 넓게 쓰고 싶다" style
  // requests are the demo's whole use case, and rarely spell out "늘려줘"
  // alongside "넓게" once "넓게" is already there.
  return SHRINK_WORDS.some((word) => feedback.includes(word)) ? -1 : 1;
}

function targetAxes(feedback: string): { width: boolean; depth: boolean } {
  const width = WIDTH_WORDS.some((word) => feedback.includes(word));
  const depth = DEPTH_WORDS.some((word) => feedback.includes(word));

  if (!width && !depth) {
    return { width: true, depth: true };
  }

  return { width, depth };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type LocalFeedbackResult = { room: RoomLayout; intent: InterpretedIntent } | { error: string };

export function applyLocalFeedback(room: RoomLayout, feedbackText: string, scenarioId?: string): LocalFeedbackResult {
  const feedback = feedbackText.trim();

  if (scenarioId === "rest-natural-wood" && isDeskReplacementRequest(feedback)) {
    const desk = room.furniture.find((item) => item.category === "desk");

    if (!desk) {
      return { error: "이 방에는 책상이(가) 없어 반영할 수 없습니다." };
    }

    const bounds = SIZE_BOUNDS.desk!;
    // A distinctly bigger jump than STEP (0.18) — "더 큰 책상으로 교체" reads
    // as wanting an actually different, proper desk, not a marginal resize.
    const nextWidth = clamp(desk.dimensions.width + 0.4, bounds.width[0], bounds.width[1]);
    // A fresh white-oak two-tone look, distinct from the light-oak "#c9a874"
    // every other natural-scenario wood piece already uses — otherwise a
    // "new design" would look identical to the old one.
    const updatedFurniture: Furniture[] = room.furniture.map((item) =>
      item.id === desk.id
        ? {
            ...item,
            name: "화이트 우드 책상",
            dimensions: { ...item.dimensions, width: nextWidth },
            color: "#ede4d3",
            material: { type: "white", color: "#ede4d3", roughness: 0.55, metalness: 0 },
          }
        : item,
    );

    return {
      room: { ...room, furniture: updatedFurniture },
      intent: {
        source: "RULE_BASED",
        rawIntent: feedback,
        targetFurniture: "책상",
        fallbackUsed: true,
      },
    };
  }

  const matched = matchCategory(feedback);

  if (!matched) {
    return {
      error: '어떤 가구(책상/침대/의자/수납장/러그)를 어떻게 조정할지 알려주세요. 예: "책상을 조금 더 넓게 쓰고 싶어"',
    };
  }

  const target = room.furniture.find((item) => item.category === matched.category);

  if (!target) {
    return { error: `이 방에는 ${matched.label}이(가) 없어 반영할 수 없습니다.` };
  }

  const direction = directionMultiplier(feedback);
  const { width: touchWidth, depth: touchDepth } = targetAxes(feedback);
  const bounds = SIZE_BOUNDS[matched.category];
  const delta = STEP * direction;

  const nextWidth = bounds && touchWidth ? clamp(target.dimensions.width + delta, bounds.width[0], bounds.width[1]) : target.dimensions.width;
  const nextDepth = bounds && touchDepth ? clamp(target.dimensions.depth + delta, bounds.depth[0], bounds.depth[1]) : target.dimensions.depth;

  if (nextWidth === target.dimensions.width && nextDepth === target.dimensions.depth) {
    return { error: `${matched.label} 크기가 이미 ${direction > 0 ? "최대" : "최소"}치라 더 이상 조정할 수 없습니다.` };
  }

  const updatedFurniture: Furniture[] = room.furniture.map((item) =>
    item.id === target.id ? { ...item, dimensions: { ...item.dimensions, width: nextWidth, depth: nextDepth } } : item,
  );

  return {
    room: { ...room, furniture: updatedFurniture },
    intent: {
      source: "RULE_BASED",
      rawIntent: feedback,
      targetFurniture: matched.label,
      fallbackUsed: true,
    },
  };
}
