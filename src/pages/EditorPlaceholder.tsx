import { useEffect, useState } from "react";
import { FiRotateCcw } from "react-icons/fi";

import { applyLayoutFeedback, createDefaultAgentContext, recommendLayout, type InterpretedIntent, type LayoutValidationResult, type ScoreSummary } from "../api/layouts";
import { applyBackendFurnitureToLayout } from "../api/rooms";
import RoomViewer from "../components/room/RoomViewer";
import { applyScenario } from "../config/scenarios";
import type { RoomLayout, Vector2D } from "../types";

function loadSelectedRoomLayout(): RoomLayout | null {
  const raw = localStorage.getItem("roomfit:selectedRoomLayout");

  if (!raw) {
    return null;
  }

  try {
    // Additive-only demo-mood furniture (see config/scenarios.ts) layered on
    // top of whatever was saved from /manage-furniture — never touches
    // sampleRoom.ts/Home.tsx, and never mutates or removes anything already
    // in this room.
    return applyScenario(JSON.parse(raw) as RoomLayout);
  } catch {
    return null;
  }
}

function loadBackendRoomId(): number {
  const raw = localStorage.getItem("roomfit:backendRoomId");
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default function EditorPlaceholder() {
  const [roomLayout, setRoomLayout] = useState<RoomLayout | null>(() => loadSelectedRoomLayout());
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [hideForegroundWalls, setHideForegroundWalls] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [isApplyingFeedback, setIsApplyingFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [validationResult, setValidationResult] = useState<LayoutValidationResult | null>(null);
  const [interpretedIntent, setInterpretedIntent] = useState<InterpretedIntent | null>(null);

  useEffect(() => {
    const layout = loadSelectedRoomLayout();

    if (layout) {
      setRoomLayout(layout);
    }
  }, []);

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

    setIsRecommending(true);
    setErrorMessage("");
    setInterpretedIntent(null);

    try {
      const roomId = loadBackendRoomId();
      const context = await createDefaultAgentContext(roomId);
      const result = await recommendLayout(roomId, context.contextId);

      setRoomLayout(applyBackendFurnitureToLayout(roomLayout, result.recommendedFurniture));
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

    try {
      const result = await applyLayoutFeedback(layoutId, feedback.trim());

      setRoomLayout(applyBackendFurnitureToLayout(roomLayout, result.recommendedFurniture));
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
                checked={hideForegroundWalls}
                onChange={(event) => setHideForegroundWalls(event.target.checked)}
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
              hideForegroundWalls={hideForegroundWalls}
            />
          </div>

          <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.08)]">
            <EditorToolButton
              label="90° 회전"
              icon={<span className="text-[11px] font-extrabold leading-none">90°</span>}
              onClick={selectedFurnitureId ? () => handleRotateFurniture(selectedFurnitureId) : undefined}
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
