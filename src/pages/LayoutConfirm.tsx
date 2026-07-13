import { FiChevronDown, FiInfo, FiShoppingBag } from "react-icons/fi";

import RoomViewer from "../components/room/RoomViewer";
import PageStepHeader from "../components/ui/PageStepHeader";
import { applyScenario } from "../config/scenarios";
import { sampleRoom } from "../mock/sampleRoom";
import type { RoomLayout } from "../types";

function loadConfirmedRoomLayout(): RoomLayout {
  const confirmed = localStorage.getItem("roomfit:confirmedRoomLayout");
  const selected = localStorage.getItem("roomfit:selectedRoomLayout");
  const raw = confirmed ?? selected;

  if (!raw) {
    return sampleRoom;
  }

  try {
    return applyScenario(JSON.parse(raw) as RoomLayout);
  } catch {
    return sampleRoom;
  }
}

export default function LayoutConfirm() {
  const roomLayout = loadConfirmedRoomLayout();
  const furnitureCount = roomLayout.furniture.length;
  const roomSize = Math.round(roomLayout.width * roomLayout.depth);

  const confirmLayout = () => {
    localStorage.setItem("roomfit:finalRoomLayout", JSON.stringify(roomLayout));
  };

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] px-5 py-7 text-[#111111] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
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
              <SummaryItem label="면적" value={`${roomSize}㎡`} />
              <SummaryItem label="가구 / 소품" value={`${furnitureCount}개`} />
              <SummaryItem label="예상 예산" value="₩ 3,450,000" />
            </dl>

            <div className="mt-8 border-t border-[#eeeeee] pt-7">
              <button
                type="button"
                onClick={confirmLayout}
                className="w-full rounded-lg bg-[#111111] px-5 py-4 text-base font-extrabold text-white transition-colors hover:bg-[#333333]"
              >
                확정하기
              </button>
              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#dddddd] bg-white px-5 py-4 text-base font-extrabold transition-colors hover:bg-[#f6f6f6]"
              >
                <FiShoppingBag className="h-5 w-5" />
                쇼핑 리스트 보기
                <FiChevronDown className="h-4 w-4" />
              </button>
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
