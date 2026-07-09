import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { FiBox, FiCheck, FiPlus, FiStar } from "react-icons/fi";

import { getSampleRooms, type SampleRoomCard } from "../api/rooms";
import { sampleRoomLayouts } from "../mock/interiorPlacementMock";

const filters = ["전체", "원룸", "사무실"];

const fallbackRoomSamples: SampleRoomCard[] = [
  { title: "오픈형 원룸", size: "6평", tone: "white", category: "원룸", layoutId: "studio-1r-sample", layout: sampleRoomLayouts[0] },
  { title: "분리형 원룸", size: "7평", tone: "wood", category: "원룸", layoutId: "studio-long-window", layout: sampleRoomLayouts[1] },
  { title: "복층형 원룸", size: "9평", tone: "cream", category: "원룸", layoutId: "studio-storage-focus", layout: sampleRoomLayouts[2] },
  { title: "넓은 1.5룸", size: "11평", tone: "bright", category: "원룸", layoutId: "studio-1r-sample", layout: sampleRoomLayouts[0] },
];

export default function Rooms() {
  const [activeFilter, setActiveFilter] = useState("전체");
  const [roomSamples, setRoomSamples] = useState<SampleRoomCard[]>(fallbackRoomSamples);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoomTitle, setSelectedRoomTitle] = useState(() => {
    return localStorage.getItem("roomfit:selectedRoomTitle") ?? "";
  });

  useEffect(() => {
    let ignore = false;

    getSampleRooms()
      .then((samples) => {
        if (!ignore && samples.length > 0) {
          setRoomSamples(samples);
        }
      })
      .catch(() => {
        if (!ignore) {
          setRoomSamples(fallbackRoomSamples);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const visibleRooms = useMemo(
    () =>
      activeFilter === "전체"
        ? roomSamples
        : roomSamples.filter((room) => room.category === activeFilter),
    [activeFilter, roomSamples],
  );

  const selectRoom = (room: SampleRoomCard) => {
    localStorage.setItem("roomfit:selectedRoomId", room.layoutId);
    localStorage.setItem("roomfit:selectedRoomTitle", room.title);
    localStorage.setItem("roomfit:selectedRoomType", room.category);
    localStorage.setItem("roomfit:selectedRoomSize", room.size);
    localStorage.setItem("roomfit:selectedRoomLayout", JSON.stringify(room.layout));
    setSelectedRoomTitle(room.title);
  };

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] text-[#141414]">
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[360px_1fr] lg:px-12 lg:py-16">
        <aside className="flex flex-col">
          <div className="mb-7 flex items-center gap-4">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-[#eeeeee] text-base font-bold">1</span>
            <span className="text-lg font-semibold">시작 / 샘플 방 선택</span>
          </div>

          <h1 className="text-[38px] font-extrabold leading-tight tracking-normal sm:text-[44px]">
            시작할 공간을
            <br />
            선택해 주세요
          </h1>

          <p className="mt-7 text-base font-medium leading-[1.7] text-[#666666]">
            원룸 샘플을 선택하거나
            <br />
            직접 빈 방에서 시작할 수 있어요.
          </p>

          <div className="mt-20 space-y-9">
            <InfoRow
              icon={<FiBox className="h-6 w-6" />}
              title="API 샘플 방 목록"
              description="백엔드 샘플 데이터를 불러와 공간을 시작합니다."
            />
            <InfoRow
              icon={<FiStar className="h-6 w-6" />}
              title="내 취향에 맞게 커스터마이즈"
              description="선택한 방을 내 생활 방식에 맞게 바꿀 수 있어요."
            />
          </div>
        </aside>

        <section>
          <div className="mb-9 flex flex-wrap items-center gap-4">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`min-w-24 rounded-full border px-7 py-3 text-sm font-bold transition-colors ${
                  filter === activeFilter
                    ? "border-[#111111] bg-[#111111] text-white shadow-[0_10px_22px_rgba(0,0,0,0.13)]"
                    : "border-[#e2e2e2] bg-white text-[#222222] hover:bg-[#f5f5f5]"
                }`}
              >
                {filter}
              </button>
            ))}
            {isLoading && <span className="text-sm font-semibold text-[#777777]">샘플 방을 불러오는 중...</span>}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {visibleRooms.map((room) => (
              <button
                key={`${room.layoutId}-${room.title}`}
                type="button"
                onClick={() => selectRoom(room)}
                className={`group relative rounded-lg border bg-white p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(0,0,0,0.08)] ${
                  selectedRoomTitle === room.title
                    ? "border-[#111111] shadow-[0_18px_35px_rgba(0,0,0,0.08)]"
                    : "border-[#e5e5e5] hover:border-[#cfcfcf]"
                }`}
              >
                {selectedRoomTitle === room.title && (
                  <span className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-[#111111] px-3 py-1 text-xs font-bold text-white">
                    <FiCheck className="h-3.5 w-3.5" />
                    선택됨
                  </span>
                )}
                <RoomPreview tone={room.tone} />
                <strong className="mt-5 block text-base font-bold text-[#151515]">{room.title}</strong>
                <span className="mt-1 block text-sm font-medium text-[#777777]">
                  {room.category} · {room.size}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                selectRoom({
                  title: "직접 만들기",
                  size: "직접 설정",
                  tone: "white",
                  category: "원룸",
                  layoutId: sampleRoomLayouts[0].id,
                  layout: sampleRoomLayouts[0],
                })
              }
              className="flex min-h-63.5 flex-col items-center justify-center rounded-lg border border-dashed border-[#d9d9d9] bg-white p-5 text-center transition-colors hover:bg-[#f6f6f6]"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full border border-[#d7d7d7]">
                <FiPlus className="h-8 w-8" />
              </span>
              <strong className="mt-8 block text-base font-bold">직접 만들기</strong>
              <span className="mt-2 text-sm text-[#777777]">새 공간 만들기</span>
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function InfoRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-5">
      <span className="mt-1 text-[#111111]">{icon}</span>
      <span>
        <strong className="block text-base font-bold">{title}</strong>
        <span className="mt-2 block text-sm leading-[1.6] text-[#777777]">{description}</span>
      </span>
    </div>
  );
}

function RoomPreview({ tone }: { tone: string }) {
  return (
    <div className={`room-preview room-preview-${tone}`}>
      <span className="room-wall room-wall-left" />
      <span className="room-wall room-wall-right" />
      <span className="room-floor" />
      <span className="room-window" />
      <span className="room-bed" />
      <span className="room-table" />
      <span className="room-rug" />
      <span className="room-plant" />
    </div>
  );
}
