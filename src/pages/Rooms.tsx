import type { FormEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBox,
  FiCheck,
  FiLink,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSmartphone,
  FiStar,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import {
  deleteUploadedRoom,
  getRecentUploadedRooms,
  getRoomById,
  type SampleRoomCard,
  type UploadedRoomCard,
} from "../api/rooms";
import PairingDialog from "../components/rooms/PairingDialog";
import { formatRoomCardDate } from "../config/roomCardDate";
import { startAppRoomsPolling, type AppRoomsPollingController } from "../config/appRoomsPolling";
import { clearBrowserRoomOrigin, getBrowserRoomOrigin } from "../config/browserRoomOrigins";
import {
  clearPendingClientHandoff,
  getOrCreateBrowserClientId,
  readActiveClientScope,
  readPendingClientHandoff,
} from "../config/clientScope";
import { hasConfirmedLayout } from "../config/confirmedLayouts";
import {
  createCustomRoom,
  readSelectedCustomRoom,
  type CustomRoomCard,
  type CustomRoomFormErrors,
  type CustomRoomFormValues,
} from "../config/customRoom";
import { clearPairedAppClientId, getPairedAppClientId } from "../config/pairedAppClient";
import { commitRoomHandoff, toHandoffErrorMessage } from "../config/roomHandoff";
import { initializeRoomSetupSession } from "../config/roomSetupSession";
import { selectScopedRoom } from "../config/roomCardSelection";
import { getRoomThumbnail } from "../config/roomThumbnails";
import { roomsPageLoader } from "../config/roomsPageLoader";
import { roomCardKey, type RoomCardScope } from "../config/scopedRoomCards";

const filters = ["전체", "원룸", "사무실"];
const selectedRoomStorageKeys = [
  "roomfit:backendRoomId",
  "roomfit:selectedRoomId",
  "roomfit:selectedRoomTitle",
  "roomfit:selectedRoomType",
  "roomfit:selectedRoomSize",
  "roomfit:selectedRoomLayout",
];
const initialCustomRoomForm: CustomRoomFormValues = {
  name: "직접 만든 방",
  width: "",
  depth: "",
};

type OwnedRoomScope = Exclude<RoomCardScope, "PUBLIC">;

interface OwnedRoomCard {
  scope: OwnedRoomScope;
  clientId: string;
  room: UploadedRoomCard;
}

export default function Rooms() {
  const [activeFilter, setActiveFilter] = useState("전체");
  const [browserClientId] = useState(() => getOrCreateBrowserClientId());
  const [pairedAppClientId, setPairedAppClientId] = useState(() => getPairedAppClientId());
  const [roomSamples, setRoomSamples] = useState<SampleRoomCard[]>([]);
  const [browserRooms, setBrowserRooms] = useState<UploadedRoomCard[]>([]);
  const [appRooms, setAppRooms] = useState<UploadedRoomCard[]>([]);
  const [isSamplesLoading, setIsSamplesLoading] = useState(true);
  const [isBrowserRoomsLoading, setIsBrowserRoomsLoading] = useState(true);
  const [isAppRoomsLoading, setIsAppRoomsLoading] = useState(Boolean(pairedAppClientId));
  const [samplesError, setSamplesError] = useState(false);
  const [browserRoomsError, setBrowserRoomsError] = useState(false);
  const [appRoomsError, setAppRoomsError] = useState(false);
  const [isServerStarting, setIsServerStarting] = useState(false);
  const [deletingRoomKey, setDeletingRoomKey] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [handoffError, setHandoffError] = useState("");
  const [pairingNotice, setPairingNotice] = useState("");
  const [selectedCardKey, setSelectedCardKey] = useState(() => getInitialSelectedCardKey());
  const [customRoom, setCustomRoom] = useState<CustomRoomCard | null>(() => readSelectedCustomRoom());
  const [isCustomRoomDialogOpen, setIsCustomRoomDialogOpen] = useState(false);
  const [isPairingDialogOpen, setIsPairingDialogOpen] = useState(false);
  const [customRoomForm, setCustomRoomForm] = useState<CustomRoomFormValues>(initialCustomRoomForm);
  const [customRoomErrors, setCustomRoomErrors] = useState<CustomRoomFormErrors>({});
  const [initialHandoff] = useState(() => readPendingClientHandoff());
  const [isHandoffResolving, setIsHandoffResolving] = useState(Boolean(initialHandoff));
  const handoffRoomRef = useRef<UploadedRoomCard | null>(null);
  const pairingTriggerRef = useRef<HTMLButtonElement>(null);
  const appRoomsPollingRef = useRef<AppRoomsPollingController | null>(null);

  useEffect(() => {
    const pendingHandoff = initialHandoff;
    if (!pendingHandoff) return;
    let ignore = false;

    getRoomById(pendingHandoff.backendRoomId)
      .then((room) => {
        if (ignore) return;
        commitRoomHandoff(room, pendingHandoff);
        handoffRoomRef.current = room;
        setSelectedCardKey(`${pendingHandoff.mode === "APP_UUID" ? "paired_app" : "legacy"}:${room.roomId}`);
        if (pendingHandoff.mode === "APP_UUID" && pendingHandoff.clientId) {
          appRoomsPollingRef.current?.stop();
          appRoomsPollingRef.current = null;
          setIsAppRoomsLoading(true);
          setIsServerStarting(false);
          setPairedAppClientId(pendingHandoff.clientId);
          setAppRooms((current) => [room, ...current.filter((item) => item.roomId !== room.roomId)]);
          setPairingNotice("RoomFit Scan과 연결되었습니다.");
        }
        setHandoffError("");
        setIsHandoffResolving(false);
      })
      .catch((error) => {
        if (ignore) return;
        clearPendingClientHandoff();
        setHandoffError(toHandoffErrorMessage(error));
        setIsHandoffResolving(false);
      });

    return () => { ignore = true; };
  }, [initialHandoff]);

  useEffect(() => {
    let ignore = false;
    roomsPageLoader.loadSamples()
      .then((samples) => {
        if (!ignore) {
          setRoomSamples(samples);
          setSamplesError(false);
        }
      })
      .catch(() => { if (!ignore) setSamplesError(true); })
      .finally(() => { if (!ignore) setIsSamplesLoading(false); });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    roomsPageLoader.loadRecent(browserClientId)
      .then((rooms) => {
        if (!ignore) {
          setBrowserRooms(rooms);
          setBrowserRoomsError(false);
        }
      })
      .catch(() => { if (!ignore) setBrowserRoomsError(true); })
      .finally(() => { if (!ignore) setIsBrowserRoomsLoading(false); });
    return () => { ignore = true; };
  }, [browserClientId]);

  useEffect(() => {
    if (!pairedAppClientId) {
      return;
    }

    const polling = startAppRoomsPolling({
      clientId: pairedAppClientId,
      loadRooms: (clientId, signal) => getRecentUploadedRooms(10, clientId, signal),
      onSuccess: (rooms) => {
        const handoffRoom = handoffRoomRef.current;
        if (handoffRoom && rooms.some((room) => room.roomId === handoffRoom.roomId)) {
          handoffRoomRef.current = null;
        }
        setAppRooms(handoffRoom && !rooms.some((room) => room.roomId === handoffRoom.roomId)
          ? [handoffRoom, ...rooms]
          : rooms);
        setAppRoomsError(false);
        setIsAppRoomsLoading(false);
      },
      onError: () => {
        setAppRoomsError(true);
        setIsAppRoomsLoading(false);
      },
    });
    appRoomsPollingRef.current = polling;
    return () => {
      polling.stop();
      if (appRoomsPollingRef.current === polling) appRoomsPollingRef.current = null;
    };
  }, [pairedAppClientId]);

  useEffect(() => {
    const loading = isSamplesLoading || isBrowserRoomsLoading || isAppRoomsLoading || isHandoffResolving;
    if (!loading) return;
    const timeoutId = window.setTimeout(() => setIsServerStarting(true), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [isAppRoomsLoading, isBrowserRoomsLoading, isHandoffResolving, isSamplesLoading]);

  const visibleSamples = useMemo(() => activeFilterValue(roomSamples, activeFilter), [activeFilter, roomSamples]);

  const retrySamples = async () => {
    setIsServerStarting(false);
    setIsSamplesLoading(true);
    setSamplesError(false);
    try {
      setRoomSamples(await roomsPageLoader.loadSamples());
    } catch {
      setSamplesError(true);
    } finally {
      setIsSamplesLoading(false);
    }
  };

  const retryBrowserRooms = async () => {
    setIsServerStarting(false);
    setIsBrowserRoomsLoading(true);
    setBrowserRoomsError(false);
    try {
      setBrowserRooms(await roomsPageLoader.loadRecent(browserClientId));
    } catch {
      setBrowserRoomsError(true);
    } finally {
      setIsBrowserRoomsLoading(false);
    }
  };

  const retryAppRooms = () => {
    if (!pairedAppClientId) return;
    setIsServerStarting(false);
    setAppRoomsError(false);
    appRoomsPollingRef.current?.refresh();
  };

  const selectRoom = (
    room: SampleRoomCard | CustomRoomCard,
    scope: RoomCardScope,
    clientId?: string,
  ) => {
    selectScopedRoom(room, scope, clientId);

    const key = "roomId" in room
      ? `${scope.toLowerCase()}:${room.roomId}`
      : `custom:${room.layoutId}`;
    setSelectedCardKey(key);
  };

  const submitCustomRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = createCustomRoom(customRoomForm);
    if (!result.success) {
      setCustomRoomErrors(result.errors);
      return;
    }
    setCustomRoom(result.room);
    selectRoom(result.room, "BROWSER", browserClientId);
    setCustomRoomErrors({});
    setIsCustomRoomDialogOpen(false);
  };

  const removeOwnedRoom = async (
    event: MouseEvent<HTMLButtonElement>,
    card: OwnedRoomCard,
  ) => {
    event.stopPropagation();
    if (!window.confirm("이 방을 삭제할까요?")) return;
    const key = roomCardKey(card);
    setDeletingRoomKey(key);
    setDeleteError("");
    try {
      await deleteUploadedRoom(card.room.roomId, card.clientId);
      if (card.scope === "BROWSER") {
        setBrowserRooms((current) => current.filter((room) => room.roomId !== card.room.roomId));
        clearBrowserRoomOrigin(card.room.roomId);
      } else {
        handoffRoomRef.current = null;
        setAppRooms((current) => current.filter((room) => room.roomId !== card.room.roomId));
      }
      if (selectedCardKey === key) {
        selectedRoomStorageKeys.forEach((storageKey) => localStorage.removeItem(storageKey));
        setSelectedCardKey("");
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "방을 삭제하지 못했습니다.");
    } finally {
      setDeletingRoomKey(null);
    }
  };

  const closePairingDialog = () => {
    setIsPairingDialogOpen(false);
    window.setTimeout(() => pairingTriggerRef.current?.focus(), 0);
  };

  const disconnectApp = () => {
    appRoomsPollingRef.current?.stop();
    appRoomsPollingRef.current = null;
    handoffRoomRef.current = null;
    clearPairedAppClientId();
    setPairedAppClientId(null);
    setAppRooms([]);
    setAppRoomsError(false);
    setIsAppRoomsLoading(false);
    setPairingNotice("");
  };

  const handlePairedApp = (clientId: string) => {
    setIsServerStarting(false);
    setPairingNotice("RoomFit Scan과 연결되었습니다.");
    if (clientId === pairedAppClientId) {
      appRoomsPollingRef.current?.refresh();
      closePairingDialog();
      return;
    }

    appRoomsPollingRef.current?.stop();
    appRoomsPollingRef.current = null;
    handoffRoomRef.current = null;
    setAppRooms([]);
    setAppRoomsError(false);
    setIsAppRoomsLoading(true);
    setPairedAppClientId(clientId);
    closePairingDialog();
  };

  const anyLoading = isSamplesLoading || isBrowserRoomsLoading || isAppRoomsLoading || isHandoffResolving;

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fbfbfb] text-[#141414]">
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[360px_1fr] lg:px-12 lg:py-16">
        <aside className="flex flex-col">
          <div className="mb-7 flex items-center gap-4">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-[#eeeeee] text-base font-bold">1</span>
            <span className="text-lg font-semibold">시작 / 공간 선택</span>
          </div>
          <h1 className="text-[38px] font-extrabold leading-tight tracking-normal sm:text-[44px]">
            시작할 공간을<br />선택해 주세요
          </h1>
          <p className="mt-7 text-base font-medium leading-[1.7] text-[#666666]">
            RoomFit Scan의 방과<br />샘플로 시작할 수 있어요.
          </p>
          <div className="mt-20 space-y-9">
            <InfoRow icon={<FiBox className="h-6 w-6" />} title="연동된 공간 목록" description="앱과 브라우저의 방을 구분해 안전하게 불러옵니다." />
            <InfoRow icon={<FiStar className="h-6 w-6" />} title="내 취향에 맞게 커스터마이즈" description="선택한 방을 내 생활 방식에 맞게 바꿀 수 있어요." />
          </div>
        </aside>

        <section className="space-y-12">
          {isServerStarting && anyLoading && (
            <div role="status" aria-live="polite" className="border-l-4 border-[#111111] bg-[#f1f1f1] px-4 py-3 text-sm font-semibold text-[#333333]">
              서버를 준비하고 있습니다. 공간 선택 화면은 먼저 사용할 수 있어요.
            </div>
          )}

          <section aria-labelledby="scan-rooms-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="scan-rooms-title" className="text-xl font-extrabold">RoomFit Scan에서 업로드된 방</h2>
                <p className="mt-1 text-sm text-[#777777]">
                  {pairedAppClientId ? `${appRooms.length}개의 스캔 공간` : "앱 연동이 필요합니다"}
                </p>
              </div>
              <FiSmartphone className="h-6 w-6 text-[#555555]" aria-hidden="true" />
            </div>

            {pairingNotice && <SuccessNotice message={pairingNotice} />}
            {handoffError && <ErrorNotice message={handoffError} />}
            {deleteError && <ErrorNotice message={deleteError} />}

            {!pairedAppClientId ? (
              <div className="flex min-h-40 flex-col items-center justify-center border-y border-[#ececec] bg-white/50 px-5 text-center">
                <p className="text-sm font-medium leading-6 text-[#666666]">
                  RoomFit Scan 앱과 연동하면 스캔한 방을 이곳에서 확인할 수 있습니다.
                </p>
                <button ref={pairingTriggerRef} type="button" onClick={() => setIsPairingDialogOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#111111] px-6 py-3 text-sm font-bold text-white hover:opacity-80">
                  <FiLink className="h-4 w-4" />RoomFit Scan과 연동하기
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap gap-3">
                  <button ref={pairingTriggerRef} type="button" onClick={() => setIsPairingDialogOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-[#d8d8d8] bg-white px-4 py-2 text-xs font-bold text-[#444444] hover:bg-[#f5f5f5]">
                    <FiLink className="h-3.5 w-3.5" />다른 RoomFit Scan과 연동
                  </button>
                  <button type="button" onClick={disconnectApp} className="inline-flex items-center gap-2 rounded-full border border-[#d8d8d8] bg-white px-4 py-2 text-xs font-bold text-[#666666] hover:text-[#b42318]">
                    <FiX className="h-3.5 w-3.5" />연동 해제
                  </button>
                </div>
                {appRoomsError && <RetryNotice message="RoomFit Scan의 방을 불러오지 못했습니다." onRetry={() => void retryAppRooms()} />}
                {isAppRoomsLoading ? <LoadingRow message="RoomFit Scan의 방을 확인하는 중..." /> : appRooms.length === 0 ? (
                  <div className="flex min-h-28 items-center justify-center border-y border-[#ececec] bg-white/50 px-5 text-center">
                    <span className="text-sm font-medium leading-6 text-[#777777]">RoomFit Scan과 연결되었습니다. 앱에서 방을 스캔하고 업로드하면 이곳에 표시됩니다.</span>
                  </div>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {appRooms.map((room) => {
                      const card: OwnedRoomCard = { scope: "PAIRED_APP", clientId: pairedAppClientId, room };
                      return <OwnedRoomArticle key={roomCardKey(card)} card={card} selected={selectedCardKey === roomCardKey(card)} deleting={deletingRoomKey === roomCardKey(card)} onSelect={() => selectRoom(room, "PAIRED_APP", pairedAppClientId)} onDelete={(event) => void removeOwnedRoom(event, card)} />;
                    })}
                  </div>
                )}
              </>
            )}
          </section>

          <section aria-labelledby="sample-rooms-title">
            <h2 id="sample-rooms-title" className="mb-5 text-xl font-extrabold">샘플 방</h2>
            <div className="mb-7 flex flex-wrap items-center gap-4">
              {filters.map((filter) => (
                <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`min-w-24 rounded-full border px-7 py-3 text-sm font-bold transition-colors ${filter === activeFilter ? "border-[#111111] bg-[#111111] text-white shadow-[0_10px_22px_rgba(0,0,0,0.13)]" : "border-[#e2e2e2] bg-white text-[#222222] hover:bg-[#f5f5f5]"}`}>{filter}</button>
              ))}
            </div>
            {samplesError && <RetryNotice message="공개 샘플을 불러오지 못했습니다." onRetry={() => void retrySamples()} />}
            {browserRoomsError && <RetryNotice message="이 브라우저에서 만든 방을 불러오지 못했습니다." onRetry={() => void retryBrowserRooms()} />}

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {isSamplesLoading && <LoadingCard message="공개 샘플을 불러오는 중..." />}
              {visibleSamples.map((room) => {
                const key = roomCardKey({ scope: "PUBLIC", room });
                return <PublicRoomCard key={key} room={room} selected={selectedCardKey === key} onSelect={() => selectRoom(room, "PUBLIC", browserClientId)} />;
              })}
              {isBrowserRoomsLoading && <LoadingCard message="내 브라우저 방을 불러오는 중..." />}
              {browserRooms.map((room) => {
                const card: OwnedRoomCard = { scope: "BROWSER", clientId: browserClientId, room };
                return <OwnedRoomArticle key={roomCardKey(card)} card={card} selected={selectedCardKey === roomCardKey(card)} deleting={deletingRoomKey === roomCardKey(card)} onSelect={() => selectRoom(room, "BROWSER", browserClientId)} onDelete={(event) => void removeOwnedRoom(event, card)} />;
              })}
              {customRoom && <CustomRoomCardButton room={customRoom} selected={selectedCardKey === `custom:${customRoom.layoutId}`} onSelect={() => selectRoom(customRoom, "BROWSER", browserClientId)} />}
              <button type="button" onClick={() => { setCustomRoomForm(initialCustomRoomForm); setCustomRoomErrors({}); setIsCustomRoomDialogOpen(true); }} aria-haspopup="dialog" className="flex min-h-63.5 flex-col items-center justify-center rounded-lg border border-dashed border-[#d9d9d9] bg-white p-5 text-center transition-colors hover:bg-[#f6f6f6]">
                <span className="grid h-16 w-16 place-items-center rounded-full border border-[#d7d7d7]"><FiPlus className="h-8 w-8" /></span>
                <strong className="mt-8 block text-base font-bold">직접 만들기</strong>
                <span className="mt-2 text-sm text-[#777777]">새 공간 만들기</span>
              </button>
            </div>
          </section>
        </section>
      </section>

      {isPairingDialogOpen && <PairingDialog onClose={closePairingDialog} onPaired={handlePairedApp} />}
      {isCustomRoomDialogOpen && <CustomRoomDialog form={customRoomForm} errors={customRoomErrors} onChange={setCustomRoomForm} onClose={() => setIsCustomRoomDialogOpen(false)} onSubmit={submitCustomRoom} />}
    </main>
  );
}

function OwnedRoomArticle({ card, selected, deleting, onSelect, onDelete }: { card: OwnedRoomCard; selected: boolean; deleting: boolean; onSelect(): void; onDelete(event: MouseEvent<HTMLButtonElement>): void }) {
  const { room } = card;
  const origin = card.scope === "BROWSER" ? getBrowserRoomOrigin(room.roomId) : null;
  const badge = card.scope === "PAIRED_APP" ? "RoomFit Scan" : origin === "DIRECT" ? "직접 만든 방" : origin === "SAMPLE_COPY" ? "샘플 복사본" : "내 브라우저 방";
  return (
    <article className={`group relative overflow-hidden rounded-lg border bg-white text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(0,0,0,0.08)] ${selected ? "border-[#111111] shadow-[0_18px_35px_rgba(0,0,0,0.08)]" : "border-[#e5e5e5] hover:border-[#cfcfcf]"} ${deleting ? "opacity-65" : ""}`}>
      <button type="button" onClick={onSelect} aria-pressed={selected} disabled={deleting} className="block w-full p-5 text-left disabled:cursor-wait">
        <div className="mb-4 flex min-h-6 items-center justify-between gap-3 pr-10"><Badge>{badge}</Badge><span className="text-xs font-medium text-[#777777]">{formatRoomCardDate(room.createdAt)}</span></div>
        <RoomPreview tone={room.tone} thumbnailUrl={getRoomThumbnail(room.layoutId, card.clientId) ?? room.thumbnailUrl} alt={room.title} />
        <strong className="mt-5 block text-base font-bold text-[#151515]">{room.title}</strong>
        <span className="mt-1 block text-sm font-medium text-[#777777]">{room.dimensions}</span>
        {hasConfirmedLayout(room.layoutId, localStorage, card.clientId) && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#eefbf1] px-2.5 py-1 text-xs font-bold text-[#16803a]"><FiCheck className="h-3.5 w-3.5" />확정됨</span>}
        {selected && <SelectedBadge />}
      </button>
      <button type="button" title="방 삭제" aria-label={`${room.title} 삭제`} disabled={deleting} onClick={onDelete} className="absolute bottom-7 right-5 z-20 grid h-9 w-9 place-items-center rounded-md bg-white text-[#555555] hover:text-[#b42318] disabled:cursor-wait disabled:opacity-50">
        {deleting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiTrash2 className="h-4 w-4" />}
      </button>
    </article>
  );
}

export function PublicRoomCard({ room, selected, onSelect }: { room: SampleRoomCard; selected: boolean; onSelect(): void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} data-room-id={room.roomId} className={`group relative overflow-hidden rounded-lg border p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(0,0,0,0.08)] ${selected ? "border-[#111111] bg-[#fafafa] ring-2 ring-[#111111] shadow-[0_18px_35px_rgba(0,0,0,0.08)]" : "border-[#e5e5e5] bg-white hover:border-[#cfcfcf]"}`}>
      <div className="mb-4"><Badge>공개 샘플</Badge></div>
      <SelectionMark selected={selected} />
      <RoomPreview tone={room.tone} thumbnailUrl={getRoomThumbnail(room.layoutId, "PUBLIC") ?? room.thumbnailUrl} alt={room.title} />
      <strong className="mt-5 block text-base font-bold text-[#151515]">{room.title}</strong>
      <span className="mt-1 block text-sm font-medium text-[#777777]">{room.category} · {room.size}</span>
    </button>
  );
}

function CustomRoomCardButton({ room, selected, onSelect }: { room: CustomRoomCard; selected: boolean; onSelect(): void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`group relative overflow-hidden rounded-lg border bg-white p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(0,0,0,0.08)] ${selected ? "border-[#111111]" : "border-[#e5e5e5]"}`}>
      <div className="mb-4"><Badge>직접 만든 방</Badge></div>{selected && <SelectedBadge />}
      <RoomPreview tone={room.tone} alt={room.title} empty />
      <strong className="mt-5 block text-base font-bold">{room.title}</strong><span className="mt-1 block text-sm text-[#777777]">{room.category} · {room.size}</span>
    </button>
  );
}

function CustomRoomDialog({ form, errors, onChange, onClose, onSubmit }: { form: CustomRoomFormValues; errors: CustomRoomFormErrors; onChange(value: CustomRoomFormValues): void; onClose(): void; onSubmit(event: FormEvent<HTMLFormElement>): void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5 py-10">
      <section role="dialog" aria-modal="true" aria-labelledby="custom-room-dialog-title" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl sm:p-8">
        <h2 id="custom-room-dialog-title" className="text-2xl font-extrabold">직접 만들기</h2><p className="mt-2 text-sm text-[#666666]">가로와 세로 길이를 입력해 빈 공간을 만듭니다.</p>
        <form className="mt-7 space-y-5" onSubmit={onSubmit} noValidate>
          <CustomRoomField id="custom-room-name" label="방 이름" value={form.name} error={errors.name} onChange={(name) => onChange({ ...form, name })} />
          <div className="grid gap-5 sm:grid-cols-2"><CustomRoomField id="custom-room-width" label="가로 길이" unit="m" value={form.width} error={errors.width} inputMode="decimal" onChange={(width) => onChange({ ...form, width })} /><CustomRoomField id="custom-room-depth" label="세로 길이" unit="m" value={form.depth} error={errors.depth} inputMode="decimal" onChange={(depth) => onChange({ ...form, depth })} /></div>
          <div className="flex justify-end gap-3 pt-3"><button type="button" onClick={onClose} className="rounded-full border border-[#d8d8d8] px-6 py-3 text-sm font-bold">취소</button><button type="submit" className="rounded-full bg-[#111111] px-7 py-3 text-sm font-bold text-white">적용</button></div>
        </form>
      </section>
    </div>
  );
}

function RetryNotice({ message, onRetry }: { message: string; onRetry(): void }) { return <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#b42318] bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#8a1c14]"><span>{message}</span><button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-full border border-[#d9a39d] px-3 py-1.5 text-xs font-bold"><FiRefreshCw />다시 시도</button></div>; }
function ErrorNotice({ message }: { message: string }) { return <div role="alert" className="mb-5 border-l-4 border-[#b42318] bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#8a1c14]">{message}</div>; }
function SuccessNotice({ message }: { message: string }) { return <div role="status" className="mb-5 border-l-4 border-[#16803a] bg-[#eefbf1] px-4 py-3 text-sm font-semibold text-[#16803a]">{message}</div>; }
function LoadingRow({ message }: { message: string }) { return <div role="status" className="flex min-h-28 items-center justify-center border-y border-[#ececec]"><span className="text-sm font-semibold text-[#777777]">{message}</span></div>; }
function LoadingCard({ message }: { message: string }) { return <div role="status" className="flex min-h-63.5 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white px-5 text-center"><span className="text-sm font-semibold text-[#777777]">{message}</span></div>; }
function Badge({ children }: { children: ReactNode }) { return <span className="inline-flex rounded-full bg-[#f0f0f0] px-2.5 py-1 text-xs font-bold text-[#444444]">{children}</span>; }
function SelectedBadge() { return <span className="absolute right-4 top-5 z-10 inline-flex items-center gap-1 rounded-full bg-[#111111] px-3 py-1.5 text-xs font-bold text-white"><FiCheck className="h-3.5 w-3.5" />선택됨</span>; }
function SelectionMark({ selected }: { selected: boolean }) { return <span aria-hidden="true" className={`absolute right-4 top-5 z-10 grid h-6 w-6 place-items-center rounded-full border ${selected ? "border-[#111111] bg-[#111111] text-white" : "border-[#d8d8d8] bg-white text-transparent"}`}><FiCheck className="h-4 w-4" /></span>; }

function activeFilterValue(rooms: SampleRoomCard[], filter: string) { return filter === "전체" ? rooms : rooms.filter((room) => room.category === filter); }
function getInitialSelectedCardKey() {
  initializeRoomSetupSession();
  const backendRoomId = Number(localStorage.getItem("roomfit:backendRoomId"));
  const active = readActiveClientScope();
  if (Number.isInteger(backendRoomId) && backendRoomId > 0) return `${active?.mode === "APP_UUID" ? "paired_app" : active?.mode === "LEGACY_HANDOFF" ? "legacy" : "browser"}:${backendRoomId}`;
  const selectedLayout = localStorage.getItem("roomfit:selectedRoomLayout");
  if (!selectedLayout) return "";
  try { const room = JSON.parse(selectedLayout); return room.source === "SAMPLE" ? `public:${String(room.id).replace("api-room-", "")}` : `custom:${room.id}`; } catch { return ""; }
}

function InfoRow({ icon, title, description }: { icon: ReactNode; title: string; description: string }) { return <div className="flex gap-5"><span className="mt-1 text-[#111111]">{icon}</span><span><strong className="block text-base font-bold">{title}</strong><span className="mt-2 block text-sm leading-[1.6] text-[#777777]">{description}</span></span></div>; }
function RoomPreview({ tone, thumbnailUrl, alt, empty = false }: { tone: string; thumbnailUrl?: string; alt: string; empty?: boolean }) { if (thumbnailUrl) return <div className="room-preview"><img src={thumbnailUrl} alt={alt} className="h-full w-full object-cover" /></div>; return <div className={`room-preview room-preview-${tone}`}><span className="room-wall room-wall-left" /><span className="room-wall room-wall-right" /><span className="room-floor" />{!empty && <><span className="room-window" /><span className="room-bed" /><span className="room-table" /><span className="room-rug" /><span className="room-plant" /></>}</div>; }
function CustomRoomField({ id, label, unit, value, error, inputMode, onChange }: { id: string; label: string; unit?: string; value: string; error?: string; inputMode?: "decimal"; onChange(value: string): void }) { const errorId = `${id}-error`; return <label htmlFor={id} className="block text-sm font-bold text-[#222222]">{label}<span className="relative mt-2 block"><input id={id} type="text" inputMode={inputMode} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className={`h-12 w-full rounded-md border bg-white px-4 pr-10 text-base font-semibold outline-none ${error ? "border-[#b42318]" : "border-[#d7d7d7] focus:border-[#111111]"}`} />{unit && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#666666]">{unit}</span>}</span>{error && <span id={errorId} className="mt-2 block text-xs font-semibold text-[#b42318]">{error}</span>}</label>; }
