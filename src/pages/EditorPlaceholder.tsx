import { useEffect, useState } from "react";
import { FiRotateCcw, FiTrash2 } from "react-icons/fi";

import { applyLayoutFeedback, createDefaultAgentContext, recommendLayout, type InterpretedIntent, type LayoutValidationResult, type ScoreSummary } from "../api/layouts";
import { applyBackendFurnitureToLayout } from "../api/rooms";
import RoomViewer from "../components/room/RoomViewer";
import { getLiveMirrorForSelectedRoom } from "../config/confirmedLayouts";
import { applyLocalFeedback } from "../config/localFeedback";
import { buildScenarioValidation } from "../config/localValidation";
import { applyScenario, currentScenario } from "../config/scenarios";
import { createHobbyCoralRecommendation, isHobbyCoralRecommendationSelected } from "../mock/hobbyCoralRecommendation";
import type { Furniture, RoomLayout, Vector2D } from "../types";

const naturalWoodRestRoomExistingFurnitureIds = new Set(["bed-1", "desk-1", "chair-1"]);

const naturalWoodRestRoomFurniture: Furniture[] = [
  {
    id: "natural-wardrobe",
    name: "루버 우드 옷장",
    category: "cabinet",
    geometry: "box",
    dimensions: { width: 0.88, depth: 0.58, height: 1.78 },
    position: { x: 2.46, z: 0.2 },
    rotationY: -Math.PI / 2,
    color: "#c9955d",
    material: { type: "wood", color: "#c9955d", roughness: 0.58, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-bedside-table",
    name: "우드 협탁",
    category: "cabinet",
    geometry: "box",
    dimensions: { width: 0.5, depth: 0.42, height: 0.48 },
    position: { x: -2.6, z: -1.3 },
    rotationY: 0,
    color: "#c9955d",
    material: { type: "wood", color: "#c9955d", roughness: 0.56, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-bedside-lamp",
    name: "침대 옆 스탠드",
    category: "lighting",
    geometry: "cylinder",
    dimensions: { width: 0.18, depth: 0.18, height: 0.48 },
    position: { x: -2.55, z: -0.92 },
    rotationY: 0,
    color: "#d4a96a",
    material: { type: "metal", color: "#d4a96a", roughness: 0.32, metalness: 0.45 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-window-plant",
    name: "바닥 식물",
    category: "cabinet",
    geometry: "cylinder",
    dimensions: { width: 0.42, depth: 0.42, height: 0.76 },
    position: { x: -2.55, z: 1.62 },
    rotationY: 0,
    color: "#3f7d4a",
    material: { type: "accent", color: "#3f7d4a", roughness: 0.8, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-low-bookshelf",
    name: "낮은 우드 책장",
    category: "cabinet",
    geometry: "box",
    dimensions: { width: 1.1, depth: 0.34, height: 0.7 },
    position: { x: 1.65, z: -2.18 },
    rotationY: 0,
    color: "#c9955d",
    material: { type: "wood", color: "#c9955d", roughness: 0.56, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-shelf-back-left",
    name: "우드 벽 선반",
    category: "cabinet",
    geometry: "box",
    dimensions: { width: 0.92, depth: 0.18, height: 0.2 },
    position: { x: 0.1, z: -2.5 },
    rotationY: 0,
    color: "#b9824a",
    material: { type: "wood", color: "#b9824a", roughness: 0.55, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-shelf-back-right",
    name: "우드 벽 선반",
    category: "cabinet",
    geometry: "box",
    dimensions: { width: 0.96, depth: 0.18, height: 0.2 },
    position: { x: 1.35, z: -2.5 },
    rotationY: 0,
    color: "#b9824a",
    material: { type: "wood", color: "#b9824a", roughness: 0.55, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-lounge-chair",
    name: "세이지 라운지 소파",
    category: "chair",
    geometry: "rounded-box",
    dimensions: { width: 0.78, depth: 0.72, height: 0.78 },
    position: { x: 1.72, z: 1.6 },
    rotationY: -Math.PI * 0.58,
    color: "#8fae76",
    material: { type: "fabric", color: "#8fae76", roughness: 0.82, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-rattan-rug",
    name: "원형 라탄 러그",
    category: "rug",
    geometry: "cylinder",
    dimensions: { width: 1.55, depth: 1.55, height: 0.035 },
    position: { x: 0.72, z: 1.36 },
    rotationY: 0,
    color: "#d4bd91",
    material: { type: "fabric", color: "#d4bd91", roughness: 0.9, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-coffee-table",
    name: "원형 우드 테이블",
    category: "desk",
    geometry: "cylinder",
    dimensions: { width: 0.68, depth: 0.68, height: 0.38 },
    position: { x: 0.72, z: 1.36 },
    rotationY: 0,
    color: "#c9955d",
    material: { type: "wood", color: "#c9955d", roughness: 0.55, metalness: 0 },
    status: "recommended",
    removable: true,
  },
  {
    id: "natural-table-plant",
    name: "화병",
    category: "cabinet",
    geometry: "cylinder",
    dimensions: { width: 0.2, depth: 0.2, height: 0.28 },
    position: { x: 0.72, z: 1.36 },
    rotationY: 0,
    color: "#4e8a55",
    material: { type: "accent", color: "#4e8a55", roughness: 0.8, metalness: 0 },
    status: "recommended",
    removable: true,
  },
];

function applyNaturalWoodRestRoom(layout: RoomLayout, sourceFurniture: Furniture[]): RoomLayout {
  const naturalWoodExistingFurniture = sourceFurniture
    .filter((item) => naturalWoodRestRoomExistingFurnitureIds.has(item.id))
    .map((item) => {
      if (item.id === "bed-1") {
        return { ...item, position: { x: -1.5, z: -1.12 }, color: "#f5f0e4", material: { type: "fabric" as const, color: "#f5f0e4", roughness: 0.88, metalness: 0 } };
      }
      if (item.id === "desk-1") {
        return { ...item, position: { x: 0.25, z: -1.85 }, rotationY: 0, color: "#d0a46c", material: { type: "wood" as const, color: "#d0a46c", roughness: 0.58, metalness: 0 } };
      }
      if (item.id === "chair-1") {
        return { ...item, position: { x: 0.25, z: -0.98 }, rotationY: Math.PI, color: "#c9955d", material: { type: "wood" as const, color: "#c9955d", roughness: 0.58, metalness: 0 } };
      }
      return item;
    });

  return {
    ...layout,
    floor: { size: { width: layout.width, depth: layout.depth }, material: { color: "#d2a86e", roughness: 0.72 } },
    lighting: { ...layout.lighting, ambient: 0.84, sun: { intensity: 1.9, position: [3.8, 7.5, 4.6] }, environment: "warm-natural-studio" },
    walls: layout.walls.map((wall) => ({ ...wall, material: { color: "#f3efe7", roughness: 0.84 } })),
    furniture: [...naturalWoodExistingFurniture, ...naturalWoodRestRoomFurniture],
  };
}

function isCollectorRoom(room: RoomLayout): boolean {
  return room.name === "미드센추리 컬렉터 룸" || room.name === "샘플룸2";
}

function applyRecommendedRoomLayout(currentRoom: RoomLayout, recommendedLayout: RoomLayout): RoomLayout {
  // Collector samples intentionally reveal their complete scripted room
  // only after the backend recommendation call. Other rooms preserve the
  // existing natural-wood demo transformation.
  return isCollectorRoom(currentRoom)
    ? recommendedLayout
    : applyNaturalWoodRestRoom(recommendedLayout, recommendedLayout.furniture);
}

// Sentinel layoutId for rooms whose "AI 추천 생성" took the scripted-mood
// shortcut (see handleRecommend below) instead of a real backend call —
// there's no backend layoutId to hand to applyLayoutFeedback in that case,
// but the "AI 피드백" panel only unlocks once layoutId is truthy, so without
// this the feedback box would stay permanently disabled for every scenario
// demo run. handleFeedback branches on this value to run applyLocalFeedback
// instead of hitting the network.
const LOCAL_SCENARIO_LAYOUT_ID = -1;

// The room as saved from /manage-furniture, unmodified — demo-mood
// restyling/additions (see config/scenarios.ts) only happen when "AI 추천
// 생성" is clicked (see handleRecommend below), not at load time. Used by
// handleResetFurniture's "초기화" button, which needs the true untouched
// baseline to discard edits back to — not whatever's currently on screen.
function loadSelectedRoomLayout(): RoomLayout | null {
  const raw = localStorage.getItem("roomfit:selectedRoomLayout");

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RoomLayout;
  } catch {
    return null;
  }
}

// What the editor should actually open showing: the live mirror (every
// edit made in /editor this session, whether formally confirmed or not) if
// this room already has one, so navigating away (e.g. to /layout-confirm)
// and back — via "이전 단계" or otherwise — doesn't appear to "reset" the
// room back to its untouched baseline. Falls back to the true baseline only
// the very first time a room is opened this session, so the AI 추천 mood
// reveal still has something to visibly change *from*.
function loadInitialRoomLayout(): RoomLayout | null {
  return getLiveMirrorForSelectedRoom() ?? loadSelectedRoomLayout();
}

function loadBackendRoomId(): number {
  const raw = localStorage.getItem("roomfit:backendRoomId");
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default function EditorPlaceholder() {
  const [roomLayout, setRoomLayout] = useState<RoomLayout | null>(() => loadInitialRoomLayout());
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [hideEntranceWalls, setHideEntranceWalls] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [isApplyingFeedback, setIsApplyingFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [validationResult, setValidationResult] = useState<LayoutValidationResult | null>(null);
  const [interpretedIntent, setInterpretedIntent] = useState<InterpretedIntent | null>(null);

  useEffect(() => {
    if (!roomLayout) {
      return;
    }

    localStorage.setItem("roomfit:confirmedRoomLayout", JSON.stringify(roomLayout));
  }, [roomLayout]);

  const handleMoveFurniture = (id: string, position: Vector2D) => {
    setRoomLayout((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        furniture: current.furniture.map((item) =>
          item.id === id
            ? {
                ...item,
                position,
              }
            : item,
        ),
      };
    });
  };

  const handleRotateFurniture = (id: string) => {
    setRoomLayout((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        furniture: current.furniture.map((item) =>
          item.id === id
            ? {
                ...item,
                rotationY: item.rotationY + Math.PI / 2,
              }
            : item,
        ),
      };
    });
  };

  const handleDeleteFurniture = (id: string) => {
    setRoomLayout((current) => {
      if (!current) {
        return current;
      }

      return { ...current, furniture: current.furniture.filter((item) => item.id !== id) };
    });
    setSelectedFurnitureId(null);
  };

  // Resets to whatever is currently saved under roomfit:selectedRoomLayout
  // (the furniture as last saved from /manage-furniture) rather than the
  // room's original as-uploaded furniture — AI recommendations/feedback and
  // manual drag/rotate edits made here never write back to that key, so
  // re-reading it always gives the furniture-management baseline.
  const handleResetFurniture = () => {
    const saved = loadSelectedRoomLayout();

    if (!saved) {
      return;
    }

    setRoomLayout((current) => (current ? { ...current, furniture: saved.furniture } : current));
    setSelectedFurnitureId(null);
  };

  const handleRecommend = async () => {
    if (!roomLayout) {
      setErrorMessage("먼저 /rooms에서 샘플 방을 선택해 주세요.");
      return;
    }

    if (isHobbyCoralRecommendationSelected()) {
      setIsRecommending(true);
      setErrorMessage("");
      setInterpretedIntent(null);

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const nextRoom = createHobbyCoralRecommendation(roomLayout);
      const { scoreSummary, validationResult } = buildScenarioValidation();

      setRoomLayout(nextRoom);
      setLayoutId(LOCAL_SCENARIO_LAYOUT_ID);
      setScoreSummary(scoreSummary);
      setValidationResult(validationResult);
      setIsRecommending(false);
      return;
    }

    // The two scripted demo moods (see config/scenarios.ts) take over here
    // instead of the real backend call — the backend has no concept of
    // "rest/minimal/gray" or "work/natural/wood," so for a room whose saved
    // preference matches one of them, restyle+add locally and skip the
    // network round trip entirely.
    const roomId = loadBackendRoomId();
    const scenario = isCollectorRoom(roomLayout) ? undefined : currentScenario();

    if (scenario) {
      setIsRecommending(true);
      setErrorMessage("");
      setInterpretedIntent(null);

      // A fixed 5s pause so "AI 추천 생성 중..." reads as the AI actually
      // working, instead of an instant swap that gives away the scripted
      // shortcut this demo path is taking.
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // The hardcoded "natural wood rest room" layout below is tuned to one
      // specific sample room's fixed dimensions/coordinates (see
      // naturalWoodRestRoomFurniture above) — it only makes sense for that
      // sample room, not for a real ROOMPLAN scan whose geometry can be
      // anything. Scanned rooms always go through the generic, room-size-
      // aware applyScenario pipeline instead.
      const nextRoom =
        scenario.id === "rest-natural-wood" && roomLayout.source !== "ROOMPLAN"
          ? applyNaturalWoodRestRoom(roomLayout, roomLayout.furniture)
          : applyScenario(roomLayout, scenario);
      const { scoreSummary, validationResult } = buildScenarioValidation();

      setRoomLayout(nextRoom);
      setLayoutId(LOCAL_SCENARIO_LAYOUT_ID);
      setScoreSummary(scoreSummary);
      setValidationResult(validationResult);
      setIsRecommending(false);
      return;
    }

    setIsRecommending(true);
    setErrorMessage("");
    setInterpretedIntent(null);

    try {
      // Real backend round trip (used by sample rooms whose purpose/style
      // don't match a scripted demo mood, e.g. the collector rooms above) —
      // a local backend answers near-instantly, which read as an instant
      // swap instead of the AI actually working. Racing it against the same
      // fixed 5s floor used by the scripted-mood path keeps that "AI 추천
      // 생성 중..." reading consistent regardless of which path a given
      // sample room happens to take.
      const [result] = await Promise.all([
        createDefaultAgentContext(roomId).then((context) => recommendLayout(roomId, context.contextId)),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);

      const recommendedLayout = applyBackendFurnitureToLayout(roomLayout, result.recommendedFurniture);
      setRoomLayout(applyRecommendedRoomLayout(roomLayout, recommendedLayout));
      setLayoutId(result.layoutId);
      setScoreSummary(result.scoreSummary);
      setValidationResult(result.validationResult);
    } catch (error) {
      console.error(error);
      setErrorMessage("AI 추천 생성에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.");
    } finally {
      setIsRecommending(false);
    }
  };

  const handleFeedback = async () => {
    if (!roomLayout) {
      setErrorMessage("먼저 /rooms에서 샘플 방을 선택해 주세요.");
      return;
    }

    if (!layoutId) {
      setErrorMessage("먼저 AI 추천 생성을 실행해 주세요.");
      return;
    }

    if (!feedback.trim()) {
      setErrorMessage("피드백을 입력해 주세요.");
      return;
    }

    setIsApplyingFeedback(true);
    setErrorMessage("");

    if (layoutId === LOCAL_SCENARIO_LAYOUT_ID) {
      // Same fixed 5s pause as the recommend flow above, so "피드백 반영 중..."
      // reads the same way instead of an instant swap.
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const result = applyLocalFeedback(roomLayout, feedback, currentScenario()?.id);

      if ("error" in result) {
        setErrorMessage(result.error);
      } else {
        const { scoreSummary, validationResult } = buildScenarioValidation();

        setRoomLayout(result.room);
        setInterpretedIntent(result.intent);
        setScoreSummary(scoreSummary);
        setValidationResult(validationResult);
      }

      setIsApplyingFeedback(false);
      return;
    }

    try {
      const result = await applyLayoutFeedback(layoutId, feedback.trim());

      const recommendedLayout = applyBackendFurnitureToLayout(roomLayout, result.recommendedFurniture);
      setRoomLayout(applyRecommendedRoomLayout(roomLayout, recommendedLayout));
      setLayoutId(result.layoutId);
      setScoreSummary(result.scoreSummary);
      setValidationResult(result.validationResult);
      setInterpretedIntent(result.interpretedIntent ?? null);
    } catch (error) {
      console.error(error);
      setErrorMessage("피드백 반영에 실패했습니다. 지원하지 않는 피드백이거나 서버 요청이 실패했을 수 있습니다.");
    } finally {
      setIsApplyingFeedback(false);
    }
  };

  if (!roomLayout) {
    return (
      <main className="grid min-h-[calc(100vh-76px)] place-items-center bg-[#fbfbfb] px-5 text-center text-[#141414]">
        <section>
          <span className="text-sm font-bold text-[#777777]">NO ROOM SELECTED</span>
          <h1 className="mt-4 text-3xl font-extrabold">선택된 방이 없습니다</h1>
          <p className="mt-4 text-base text-[#777777]">먼저 /rooms에서 샘플 방을 선택한 뒤 편집 화면으로 이동해 주세요.</p>
        </section>
      </main>
    );
  }

  const warnings = validationResult?.warnings ?? [];

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] text-[#141414]">
      <section className="grid min-h-[calc(100vh-76px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative flex min-h-140 flex-col px-6 py-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="min-w-0 truncate text-2xl font-extrabold ml-2">{roomLayout.name}</h1>
              <span className="rounded-full bg-[#eeeeee] px-3 py-1 text-xs font-bold text-[#777777]">
                가구 {roomLayout.furniture.length}개
              </span>
              <span className="rounded-full bg-[#eeeeee] px-3 py-1 text-xs font-bold text-[#777777]">
                {roomLayout.width}m × {roomLayout.depth}m
              </span>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#dfdfdf] bg-white px-3 py-2 text-sm font-extrabold text-[#333333] transition-colors hover:bg-[#f6f6f6]">
              <input
                type="checkbox"
                checked={hideEntranceWalls}
                onChange={(event) => setHideEntranceWalls(event.target.checked)}
                className="h-4 w-4 accent-[#111111]"
              />
              내부 보기
            </label>
          </div>

          <div className="manage-room flex-1">
            <RoomViewer
              room={roomLayout}
              furniture={roomLayout.furniture}
              selectedFurnitureId={selectedFurnitureId}
              onSelectFurniture={setSelectedFurnitureId}
              onMoveFurniture={handleMoveFurniture}
              hideEntranceWalls={hideEntranceWalls}
              alignCameraToEntrance
              showEditingHelpers
            />
          </div>

          <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.08)]">
            <EditorToolButton
              label="90° 회전"
              icon={<span className="text-[11px] font-extrabold leading-none">90°</span>}
              onClick={selectedFurnitureId ? () => handleRotateFurniture(selectedFurnitureId) : undefined}
            />
            <EditorToolButton
              label="가구 삭제"
              icon={<FiTrash2 />}
              onClick={selectedFurnitureId ? () => handleDeleteFurniture(selectedFurnitureId) : undefined}
            />
            <EditorToolButton label="초기화" icon={<FiRotateCcw />} onClick={handleResetFurniture} />
          </div>
        </section>

        <aside className="space-y-5 border-t border-[#eeeeee] bg-[#fbfbfb] p-5 lg:border-l lg:border-t-0">
          <section className="rounded-xl border border-[#e6e6e6] bg-white p-5">
            <h2 className="text-lg font-extrabold">AI 피드백</h2>
            {!layoutId ? (
              <div className="mt-4 rounded-lg border border-dashed border-[#d8d8d8] bg-[#f7f7f7] p-4">
                <strong className="block text-sm font-extrabold text-[#333333]">먼저 AI 추천 배치를 생성해 주세요</strong>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#777777]">
                  추천 배치가 만들어진 뒤에 원하는 변경사항을 피드백으로 반영할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={handleRecommend}
                  disabled={isRecommending}
                  className="mt-4 w-full rounded-lg bg-[#111111] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#999999]"
                >
                  {isRecommending ? "AI 추천 생성 중..." : "AI 추천 생성하기"}
                </button>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm font-medium leading-6 text-[#777777]">
                  자연어 피드백을 LLM이 intent로 해석하고, 백엔드 규칙 기반 로직이 배치에 반영합니다.
                </p>

                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  className="mt-4 min-h-28 w-full resize-none rounded-lg border border-[#dddddd] bg-[#fbfbfb] p-4 text-sm font-semibold outline-none focus:border-[#111111]"
                  placeholder="(예) 책상을 조금 더 넓게 쓰고 싶어"
                />

                <button
                  type="button"
                  onClick={handleFeedback}
                  disabled={isApplyingFeedback}
                  className="mt-3 w-full rounded-lg bg-[#111111] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#bbbbbb]"
                >
                  {isApplyingFeedback ? "피드백 반영 중..." : "피드백 반영"}
                </button>
              </>
            )}
          </section>

          {interpretedIntent && (
            <section className="rounded-xl border border-[#dfe8ff] bg-[#f7f9ff] p-5">
              <h2 className="text-lg font-extrabold">LLM 해석 결과</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <InfoItem label="source" value={interpretedIntent.source ?? "-"} />
                <InfoItem label="intent" value={interpretedIntent.rawIntent ?? "-"} />
                <InfoItem label="target" value={interpretedIntent.targetFurniture ?? "-"} />
                <InfoItem label="fallback" value={String(interpretedIntent.fallbackUsed ?? false)} />
              </dl>
            </section>
          )}

          {scoreSummary && (
            <section className="rounded-xl border border-[#e6e6e6] bg-white p-5">
              <h2 className="text-lg font-extrabold">배치 점수</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Score label="충돌" value={scoreSummary.collisionScore} />
                <Score label="경계" value={scoreSummary.boundaryScore} />
                <Score label="동선" value={scoreSummary.pathScore} />
                <Score label="총점" value={scoreSummary.totalScore} />
              </div>
            </section>
          )}

          {validationResult && (
            <section className="rounded-xl border border-[#e6e6e6] bg-white p-5">
              <h2 className="text-lg font-extrabold">검증 결과</h2>
              <div className="mt-4 space-y-2 text-sm font-semibold">
                <CheckLine label="충돌 없음" ok={validationResult.collisionFree} />
                <CheckLine label="방 경계 내 배치" ok={validationResult.boundaryValid} />
                <CheckLine label="문 앞 공간 확보" ok={validationResult.doorClearance} />
                <CheckLine label="창문 앞 공간 확보" ok={validationResult.windowClearance} />
                <CheckLine label="이동 동선 확보" ok={validationResult.pathSecured} />
              </div>

              {warnings.length > 0 && (
                <div className="mt-4 rounded-xl bg-[#fff8e6] p-4">
                  <strong className="text-sm font-extrabold text-[#9a6500]">경고</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-[#8a5a00]">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {errorMessage && (
            <section className="rounded-xl border border-[#ffd8d8] bg-[#fff5f5] p-5 text-sm font-bold text-[#c0392b]">
              {errorMessage}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-bold text-[#777777]">{label}</dt>
      <dd className="font-extrabold text-[#111111]">{value}</dd>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f7f7f7] p-3">
      <span className="block text-xs font-bold text-[#777777]">{label}</span>
      <strong className="mt-1 block text-lg text-center font-extrabold">{value}</strong>
    </div>
  );
}

function CheckLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={ok ? "text-[#16803a]" : "text-[#d35400]"}>{ok ? "양호" : "경고"}</span>
    </div>
  );
}

function EditorToolButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={!onClick}
      className="grid h-8 w-8 place-items-center rounded-full text-[#222222] hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
    </button>
  );
}
