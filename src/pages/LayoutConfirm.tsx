import { useEffect, useRef, useState } from "react";
import { FaRug } from "react-icons/fa6";
import { FiCheck, FiChevronDown, FiChevronUp, FiExternalLink, FiHome, FiInfo, FiShoppingBag } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { MdOutlineBed, MdOutlineDesk, MdOutlineLibraryBooks, MdOutlineLightbulb, MdOutlineWeekend } from "react-icons/md";

import RoomViewer from "../components/room/RoomViewer";
import PageStepHeader from "../components/ui/PageStepHeader";
import { resolveCurrentRoomLayout, saveConfirmedLayout } from "../config/confirmedLayouts";
import { resolveRoomLayoutPreferredColorTone } from "../config/appliedColorTone";
import { fetchMockProducts, type MockProductApiItem } from "../api/products";
import {
  createAppliedRoomPreferences,
  readCurrentPreferences,
  saveRoomPreferences,
} from "../config/roomPreferences";
import { captureCanvasThumbnail, saveRoomThumbnail } from "../config/roomThumbnails";
import { completeRoomSetupSession } from "../config/roomSetupSession";
import { confirmActiveLayout, refreshActiveDraftNavigationState } from "../config/layoutEditingWorkflow";
import { RecommendationFeasibilityError } from "../config/recommendationResult";
import {
  isSessionForRoom,
  readActiveLayoutEditingSession,
  readLayoutNavigationState,
} from "../config/layoutEditingSession";
import type { FurnitureCategory } from "../types";

// EXPERIMENTAL (experimental/develop): keyed by the room's own (coarse)
// FurnitureCategory now, not a scenario-specific iconKey -- this list used
// to only cover the 7 pieces the one hardcoded rest-natural-wood scenario
// could ever contain. "unsupported" is the fallback for any category this
// map doesn't recognize.
const SHOPPING_LIST_ICONS: Record<FurnitureCategory, typeof MdOutlineBed> = {
  bed: MdOutlineBed,
  desk: MdOutlineDesk,
  chair: MdOutlineWeekend,
  cabinet: MdOutlineLibraryBooks,
  rug: FaRug,
  lighting: MdOutlineLightbulb,
  unsupported: FiShoppingBag,
};

const SHOPPING_LIST_CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  bed: "침실 가구",
  desk: "책상 / 테이블",
  chair: "의자 / 소파",
  cabinet: "수납 가구",
  rug: "러그",
  lighting: "조명",
  unsupported: "가구",
};

export default function LayoutConfirm() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = readLayoutNavigationState(location.state);
  const fallbackRoom = resolveCurrentRoomLayout();
  const backendRoomId = Number(localStorage.getItem("roomfit:backendRoomId"));
  const activeSession = readActiveLayoutEditingSession();
  const hasMatchingDraft = Number.isInteger(backendRoomId)
    && isSessionForRoom(activeSession, fallbackRoom.id, backendRoomId)
    && !activeSession.confirmed;
  const ownedRouteState = routeState
    && routeState.roomId === backendRoomId
    && routeState.roomLayoutId === fallbackRoom.id
    && (!hasMatchingDraft || routeState.activeLayoutId === activeSession?.activeLayoutId)
    ? routeState
    : null;
  const [roomLayout, setRoomLayout] = useState(() => ownedRouteState?.roomLayout ?? (hasMatchingDraft ? null : fallbackRoom));
  const [loadError, setLoadError] = useState("");
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [products, setProducts] = useState<MockProductApiItem[] | null>(null);
  const roomViewerContainerRef = useRef<HTMLDivElement>(null);
  const activeLayoutId = activeSession && hasMatchingDraft ? activeSession.activeLayoutId : null;

  // EXPERIMENTAL (experimental/develop): fetched once and matched against
  // this room's furniture by productId, replacing the old hardcoded
  // per-scenario shopping list (see naturalScenarioShoppingList.ts).
  useEffect(() => {
    let cancelled = false;
    fetchMockProducts()
      .then((items) => {
        if (!cancelled) {
          setProducts(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (roomLayout || activeLayoutId === null) return;
    let cancelled = false;
    refreshActiveDraftNavigationState()
      .then((state) => {
        if (!cancelled && state?.roomLayout) {
          setRoomLayout(state.roomLayout);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("편집 중인 배치를 불러오지 못했습니다. Editor에서 다시 저장해 주세요.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeLayoutId, roomLayout]);

  if (!roomLayout) {
    return (
      <main className="grid min-h-[calc(100vh-76px)] place-items-center bg-[#fbfbfb] px-5 text-center">
        <p role={loadError ? "alert" : undefined} className="font-bold text-[#777777]">
          {loadError || "편집 중인 배치를 불러오는 중입니다..."}
        </p>
      </main>
    );
  }

  const preferredColorTone = resolveRoomLayoutPreferredColorTone(roomLayout);
  const furnitureCount = roomLayout.furniture.filter((item) => item.status !== "deleted").length;
  // Actual scanned width x depth (matches how Rooms.tsx shows room size on
  // its cards) rather than a computed ㎡ figure — a real width/depth pair
  // like "3.38m x 3.47m" reads as the literal room shape, whereas the
  // rounded ㎡ number collapses distinguishable room shapes down to the same
  // digit and doesn't match anything the user actually recognizes as "their
  // room."
  const roomSize = `${roomLayout.width}m × ${roomLayout.depth}m`;
  // EXPERIMENTAL (experimental/develop): built from this room's actual
  // recommended/existing furniture (matched by productId against the real
  // product catalog) instead of a hardcoded per-scenario list -- so it
  // reflects whatever was really placed, not just one specific demo mood.
  // Furniture with no productId (never product-matched) or whose product
  // has no purchaseUrl (~4 of 99 mock products, all legacy) is skipped
  // rather than shown with a dead link.
  const productById = new Map((products ?? []).map((product) => [product.productId, product]));
  const shoppingListEntries = roomLayout.furniture
    .filter((item) => item.status !== "deleted" && item.productId)
    .map((item) => ({ item, product: item.productId ? productById.get(item.productId) : undefined }))
    .filter((entry): entry is { item: typeof roomLayout.furniture[number]; product: MockProductApiItem } =>
      Boolean(entry.product?.purchaseUrl),
    );

  const confirmLayout = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    setConfirmError("");

    try {
      const layoutToConfirm = await confirmActiveLayout(roomLayout);

      saveConfirmedLayout(layoutToConfirm.id, layoutToConfirm);
      localStorage.setItem("roomfit:selectedRoomLayout", JSON.stringify(layoutToConfirm));
      localStorage.setItem("roomfit:confirmedRoomLayout", JSON.stringify(layoutToConfirm));

    // Snapshots whatever purpose/palette/style/추가 가구 this room actually
    // used — Rooms.tsx's selectRoom restores this the next time this same
    // room is picked, so reopening a confirmed room shows its own real
    // choices instead of whatever room was selected most recently elsewhere.
      saveRoomPreferences(
        layoutToConfirm.id,
        createAppliedRoomPreferences(readCurrentPreferences(), preferredColorTone),
      );

    // /manage-furniture also captures a thumbnail (its "내부 보기" toggle),
    // but that happens early in the flow, before /preference's style pick or
    // /editor's "AI 추천 생성" — so it can only ever be the room's raw,
    // pre-scenario furniture, and never updates again after that. This
    // capture (of the actual final, styled result being confirmed right
    // now) overwrites that with the real final look, so /rooms' thumbnail
    // reflects whichever scenario actually ended up confirmed instead of
    // staying frozen at that one early snapshot.
      const container = roomViewerContainerRef.current;
      const dataUrl = container && captureCanvasThumbnail(container);

      if (dataUrl) {
        saveRoomThumbnail(layoutToConfirm.id, dataUrl);
      }

      completeRoomSetupSession();
      setJustConfirmed(true);
    } catch (error) {
      setConfirmError(
        error instanceof RecommendationFeasibilityError
          ? "추천이 완료되지 않아 확정할 수 없습니다. 가구 선택으로 돌아가 다시 추천해 주세요."
          : "배치를 확정하지 못했습니다. 저장 상태를 확인한 뒤 다시 시도해 주세요.",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-76px)] overflow-x-hidden bg-[#fbfbfb] px-5 py-7 text-[#111111] sm:px-8 lg:px-10">
      <div
        className={`mx-auto transition-[max-width] duration-500 ease-in-out ${
          showShoppingList ? "max-w-[1620px]" : "max-w-7xl"
        }`}
      >
        {/* The shopping-list aside is a real sibling of 요약 정보 inside this
            same grid/row (not a separate flex block bolted on the side) so
            `lg:items-center` centers both of them against the same row
            height — that's what lines the panel's top edge up with 요약
            정보's instead of the page title further up. The third column's
            own width (0 -> 360px, not display/visibility) is what pushes the
            first column over to make room, and both templates keep the same
            3-track shape so the width itself can transition smoothly. */}
        <div
          className={`grid gap-8 transition-[grid-template-columns] duration-500 ease-in-out lg:items-center ${
            showShoppingList ? "lg:grid-cols-[minmax(0,1fr)_360px_360px]" : "lg:grid-cols-[minmax(0,1fr)_360px_0px]"
          }`}
        >
          <section className="min-w-0">
            <PageStepHeader step={8} title="최종 배치 확정" className="mb-8" />

            <div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-normal">
                {justConfirmed ? "최종 배치가 확정되었습니다" : "최종 배치를 확정할까요?"}
              </h1>
              <p className="mt-5 text-lg font-semibold leading-8 text-[#777777]">
                {justConfirmed ? (
                  <>
                    이제 쇼핑 리스트를 확인해보세요.
                    <br />
                    언제든지 다시 편집할 수 있어요.
                  </>
                ) : (
                  <>
                    마음에 드는 결과라면 확정하고
                    <br />
                    쇼핑 리스트도 확인해보세요.
                  </>
                )}
              </p>
            </div>

            <div className="confirm-room mt-3 min-h-96" ref={roomViewerContainerRef}>
              <RoomViewer
                room={roomLayout}
                furniture={roomLayout.furniture}
                selectedFurnitureId={null}
                onSelectFurniture={() => undefined}
                onMoveFurniture={() => undefined}
                hideEntranceWalls
                alignCameraToEntrance
                preferredColorTone={preferredColorTone}
              />
            </div>
          </section>

          <aside className="self-start rounded-xl border border-[#e3e3e3] bg-white p-6">
            <h2 className="text-lg font-extrabold">요약 정보</h2>

            <dl className="mt-6 space-y-5 text-base">
              <SummaryItem label="방 이름" value={roomLayout.name} />
              <SummaryItem label="면적" value={roomSize} />
              <SummaryItem label="가구 / 소품" value={`${furnitureCount}개`} />
            </dl>

            <div className="mt-6 border-t border-[#eeeeee] pt-6">
              {!justConfirmed ? (
                <button
                  type="button"
                  onClick={confirmLayout}
                  disabled={isConfirming}
                  className="w-full rounded-lg bg-[#111111] px-5 py-4 text-base font-extrabold text-white transition-colors hover:bg-[#333333]"
                >
                  {isConfirming ? "저장 중..." : "확정하기"}
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

                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="animate-fade-slide-up mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111111] px-5 py-4 text-base font-extrabold text-white transition-colors hover:bg-[#333333]"
                  >
                    <FiHome className="h-5 w-5" />
                    홈 화면으로 돌아가기
                  </button>
                </>
              )}
            </div>
            {confirmError && (
              <p role="alert" className="mt-4 rounded-lg bg-[#fff1f1] px-4 py-3 text-sm font-bold text-[#b42318]">
                {confirmError}
              </p>
            )}
          </aside>

          <aside
            className={`min-w-0 self-start overflow-hidden rounded-xl border bg-white transition-opacity duration-500 ease-in-out ${
              showShoppingList ? "border-[#e3e3e3] opacity-100" : "border-transparent opacity-0"
            }`}
          >
            <div className="w-[360px] p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
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

              {products === null ? (
                <p className="text-sm font-semibold leading-6 text-[#777777]">쇼핑 리스트를 불러오는 중이에요...</p>
              ) : shoppingListEntries.length === 0 ? (
                <p className="text-sm font-semibold leading-6 text-[#777777]">
                  이 방의 가구에는 아직 연결된 구매 링크가 없어요.
                </p>
              ) : (
                <ul className="space-y-3">
                  {shoppingListEntries.map(({ item, product }) => {
                    const Icon = SHOPPING_LIST_ICONS[item.category];

                    return (
                      <li key={item.id}>
                        <a
                          href={product.purchaseUrl!}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3.5 rounded-lg border border-[#eeeeee] p-3 transition-colors hover:border-[#111111] hover:bg-[#f9f9f9]"
                        >
                          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-[#f3f0eb]">
                            <Icon className="h-6 w-6 text-[#8b633d]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm font-bold">{item.name || product.name}</strong>
                            <span className="mt-0.5 block truncate text-xs font-medium text-[#999999]">
                              {SHOPPING_LIST_CATEGORY_LABELS[item.category]}
                            </span>
                          </span>
                          <FiExternalLink className="h-4 w-4 shrink-0 text-[#999999]" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
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
