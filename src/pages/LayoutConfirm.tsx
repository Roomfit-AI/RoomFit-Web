import { useState } from "react";
import { FiCheck, FiChevronDown, FiChevronUp, FiExternalLink, FiInfo, FiShoppingBag } from "react-icons/fi";

import RoomViewer from "../components/room/RoomViewer";
import PageStepHeader from "../components/ui/PageStepHeader";
import { resolveCurrentRoomLayout, saveConfirmedLayout } from "../config/confirmedLayouts";
import { NATURAL_SCENARIO_SHOPPING_LIST } from "../config/naturalScenarioShoppingList";
import { currentScenario } from "../config/scenarios";

export default function LayoutConfirm() {
  const roomLayout = resolveCurrentRoomLayout();
  const furnitureCount = roomLayout.furniture.length;
  // Actual scanned width x depth (matches how Rooms.tsx shows room size on
  // its cards) rather than a computed ㎡ figure — a real width/depth pair
  // like "3.38m x 3.47m" reads as the literal room shape, whereas the
  // rounded ㎡ number collapses distinguishable room shapes down to the same
  // digit and doesn't match anything the user actually recognizes as "their
  // room."
  const roomSize = `${roomLayout.width}m × ${roomLayout.depth}m`;
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  // Real 오늘의집 product links only exist for the 네츄럴 톤 demo scenario
  // (see naturalScenarioShoppingList.ts) — there's no product-matching
  // backend to look these up generically for any other scenario/room.
  const isNaturalScenario = currentScenario()?.id === "rest-natural-wood";

  const confirmLayout = () => {
    // No backend endpoint saves a finalized layout back to a room (see
    // api/rooms.ts) — this keeps the result locally, keyed by the room's own
    // id, so reopening this same room later (see Rooms.tsx's selectRoom)
    // picks the confirmed result back up instead of the bare as-uploaded
    // furniture.
    saveConfirmedLayout(roomLayout.id, roomLayout);
    setJustConfirmed(true);
  };

  return (
    <main className="min-h-[calc(100vh-76px)] overflow-x-hidden bg-[#fbfbfb] px-5 py-7 text-[#111111] sm:px-8 lg:px-10">
      <div
        className={`mx-auto transition-[max-width] duration-500 ease-in-out ${
          showShoppingList ? "max-w-[1620px]" : "max-w-7xl"
        }`}
      >
        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1 transition-[flex-basis] duration-500 ease-in-out">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <section className="min-w-0">
                <PageStepHeader step={8} title="최종 배치 확정" className="mb-8" />

                <div>
                  <h1 className="text-4xl font-extrabold leading-tight tracking-normal">최종 배치를 확정할까요?</h1>
                  <p className="mt-5 text-lg font-semibold leading-8 text-[#777777]">
                    마음에 드는 결과라면 확정하고
                    <br />
                    쇼핑 리스트도 확인해보세요.
                  </p>
                </div>

                <div className="confirm-room mt-3 min-h-96">
                  <RoomViewer
                    room={roomLayout}
                    furniture={roomLayout.furniture}
                    selectedFurnitureId={null}
                    onSelectFurniture={() => undefined}
                    onMoveFurniture={() => undefined}
                    hideEntranceWalls
                    alignCameraToEntrance
                  />
                </div>
              </section>

              <aside className="rounded-xl border border-[#e3e3e3] bg-white p-7">
                <h2 className="text-lg font-extrabold">요약 정보</h2>

                <dl className="mt-8 space-y-8 text-base">
                  <SummaryItem label="방 이름" value={roomLayout.name} />
                  <SummaryItem label="면적" value={roomSize} />
                  <SummaryItem label="가구 / 소품" value={`${furnitureCount}개`} />
                </dl>

                <div className="mt-8 border-t border-[#eeeeee] pt-7">
                  {!justConfirmed ? (
                    <button
                      type="button"
                      onClick={confirmLayout}
                      className="w-full rounded-lg bg-[#111111] px-5 py-4 text-base font-extrabold text-white transition-colors hover:bg-[#333333]"
                    >
                      확정하기
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 rounded-lg bg-[#eefbf1] px-5 py-4 text-sm font-bold text-[#16803a]">
                        <FiCheck className="h-5 w-5 shrink-0" />
                        이 방에 배치가 저장되었어요. 다시 열어도 이 결과가 보여요.
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowShoppingList((current) => !current)}
                        aria-expanded={showShoppingList}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#dddddd] bg-white px-5 py-4 text-base font-extrabold transition-colors hover:bg-[#f6f6f6]"
                      >
                        <FiShoppingBag className="h-5 w-5" />
                        쇼핑 리스트 {showShoppingList ? "닫기" : "보기"}
                        {showShoppingList ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                      </button>
                    </>
                  )}
                </div>
              </aside>
            </div>

            <section className="mt-6 flex items-center gap-5 rounded-xl border border-[#e7e7e7] bg-white px-7 py-5">
              <FiInfo className="h-8 w-8 shrink-0 stroke-[1.7]" />
              <div>
                <strong className="block text-base font-extrabold">TIP</strong>
                <p className="mt-1 text-sm font-semibold text-[#777777]">확정 후 언제든지 다시 편집할 수 있어요.</p>
              </div>
            </section>
          </div>

          {/* Sliding shopping-list panel — width animates 0 -> 360px instead of
              a plain show/hide, which is what actually pushes the content on
              the left over to make room (a width-0 flex sibling with
              `overflow-hidden` collapses to nothing; growing it shoves the
              `flex-1` sibling left as it expands), matching "왼쪽으로 밀어서
              공간을 만들고 오른쪽에서 슬라이드 인" rather than an instant cut. */}
          <aside
            className={`shrink-0 overflow-hidden rounded-xl border bg-white transition-all duration-500 ease-in-out ${
              showShoppingList ? "w-[360px] border-[#e3e3e3] opacity-100" : "w-0 border-transparent opacity-0"
            }`}
          >
            <div className="w-[360px] p-7">
              <div className="mb-6 flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold">쇼핑 리스트</h2>
                <button
                  type="button"
                  onClick={() => setShowShoppingList(false)}
                  aria-label="쇼핑 리스트 닫기"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#777777] hover:bg-[#f2f2f2]"
                >
                  <FiChevronUp className="h-4 w-4" />
                </button>
              </div>

              {isNaturalScenario ? (
                <ul className="space-y-3">
                  {NATURAL_SCENARIO_SHOPPING_LIST.map((entry) => (
                    <li key={entry.name}>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-lg border border-[#eeeeee] px-4 py-3.5 text-sm font-bold transition-colors hover:border-[#111111] hover:bg-[#f9f9f9]"
                      >
                        {entry.name}
                        <FiExternalLink className="h-4 w-4 shrink-0 text-[#999999]" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-semibold leading-6 text-[#777777]">
                  이 스타일의 쇼핑 리스트는 아직 준비 중이에요.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-extrabold text-[#111111]">{label}</dt>
      <dd className="mt-3 break-keep text-lg font-semibold text-[#111111]">{value}</dd>
    </div>
  );
}
