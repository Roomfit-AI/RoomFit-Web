import type { DependencyList, EffectCallback, ReactElement, ReactNode, SetStateAction } from "react";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import PairingDialog from "../../components/rooms/PairingDialog";
import type { SampleRoomCard, UploadedRoomCard } from "../../api/rooms";
import { BROWSER_CLIENT_ID_KEY } from "../../config/clientScope";
import { PAIRED_APP_CLIENT_ID_KEY } from "../../config/pairedAppClient";
import { roomsPageLoader } from "../../config/roomsPageLoader";
import Rooms, { PublicRoomCard } from "../Rooms";

interface HookRuntimeRef {
  current: HookRuntime | null;
}

const hookRuntimeRef = vi.hoisted<HookRuntimeRef>(() => ({ current: null }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState<T>(initial: T | (() => T)) {
      return hookRuntimeRef.current?.useState(initial) ?? actual.useState(initial);
    },
    useEffect(effect: EffectCallback, dependencies?: DependencyList) {
      if (hookRuntimeRef.current) {
        hookRuntimeRef.current.useEffect(effect, dependencies);
        return;
      }
      return actual.useEffect(effect, dependencies);
    },
    useMemo<T>(factory: () => T, dependencies: DependencyList) {
      return hookRuntimeRef.current?.useMemo(factory, dependencies)
        ?? actual.useMemo(factory, dependencies);
    },
    useRef<T>(initial: T) {
      return hookRuntimeRef.current?.useRef(initial) ?? actual.useRef(initial);
    },
  };
});

const BROWSER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("Rooms scope UI", () => {
  afterEach(() => {
    hookRuntimeRef.current = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the unpaired Scan CTA while keeping Sample and direct-create UI visible", () => {
    installStorage();
    const html = renderToStaticMarkup(<Rooms />);

    expect(html).toContain("RoomFit Scan에서 업로드된 방");
    expect(html).toContain("RoomFit Scan과 연동하기");
    expect(html).toContain("샘플 방");
    expect(html).toContain("직접 만들기");
  });

  it("restores the paired state without displaying the App UUID", () => {
    installStorage({ [PAIRED_APP_CLIENT_ID_KEY]: APP_ID });
    const html = renderToStaticMarkup(<Rooms />);

    expect(html).toContain("다른 RoomFit Scan과 연동");
    expect(html).toContain("연동 해제");
    expect(html).not.toContain(APP_ID);
  });

  it("renders an accessible pairing dialog contract", () => {
    installStorage();
    const html = renderToStaticMarkup(<PairingDialog onClose={() => undefined} onPaired={() => undefined} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('placeholder="K7X9-QP42"');
    expect(html).toContain("한 번 연동하면");
  });
});

describe("Rooms initial loading lifecycle", () => {
  afterEach(() => {
    hookRuntimeRef.current = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows exactly one combined LoadingCard while both sources are pending", () => {
    const samples = deferred<SampleRoomCard[]>();
    const recentRooms = deferred<UploadedRoomCard[]>();
    const mounted = mountRooms(samples.promise, recentRooms.promise);

    expect(occurrences(mounted.html(), "공간을 불러오는 중...")).toBe(1);
    expect(roomsPageLoader.loadSamples).toHaveBeenCalledTimes(1);
    expect(roomsPageLoader.loadRecent).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it("keeps the combined LoadingCard until Recent settles when Sample succeeds first", async () => {
    const samples = deferred<SampleRoomCard[]>();
    const recentRooms = deferred<UploadedRoomCard[]>();
    const mounted = mountRooms(samples.promise, recentRooms.promise);

    samples.resolve([sample(1, "먼저 온 샘플")]);
    await flushPromises();
    expect(occurrences(mounted.html(), "공간을 불러오는 중...")).toBe(1);
    expect(mounted.html()).not.toContain("먼저 온 샘플");

    recentRooms.resolve([recent(2, "나중에 온 최근 방")]);
    await flushPromises();
    const finalHtml = mounted.html();
    expect(finalHtml).toContain("먼저 온 샘플");
    expect(finalHtml).toContain("나중에 온 최근 방");
    expect(finalHtml).not.toContain("공간을 불러오는 중...");

    mounted.unmount();
  });

  it("keeps the combined LoadingCard until Sample settles when Recent succeeds first", async () => {
    const samples = deferred<SampleRoomCard[]>();
    const recentRooms = deferred<UploadedRoomCard[]>();
    const mounted = mountRooms(samples.promise, recentRooms.promise);

    recentRooms.resolve([recent(2, "먼저 온 최근 방")]);
    await flushPromises();
    expect(occurrences(mounted.html(), "공간을 불러오는 중...")).toBe(1);
    expect(mounted.html()).not.toContain("먼저 온 최근 방");

    samples.resolve([sample(1, "나중에 온 샘플")]);
    await flushPromises();
    const finalHtml = mounted.html();
    expect(finalHtml).toContain("먼저 온 최근 방");
    expect(finalHtml).toContain("나중에 온 샘플");
    expect(finalHtml).not.toContain("공간을 불러오는 중...");

    mounted.unmount();
  });

  it("keeps Recent cards and shows the Sample RetryNotice after Sample fails", async () => {
    const samples = deferred<SampleRoomCard[]>();
    const recentRooms = deferred<UploadedRoomCard[]>();
    const mounted = mountRooms(samples.promise, recentRooms.promise);

    samples.reject(new Error("sample offline"));
    recentRooms.resolve([recent(2, "유지되는 최근 방")]);
    await flushPromises();
    const html = mounted.html();

    expect(html).toContain("유지되는 최근 방");
    expect(html).toContain("공개 샘플을 불러오지 못했습니다.");
    expect(html).not.toContain("공간을 불러오는 중...");

    mounted.unmount();
  });

  it("keeps Sample cards and shows the Recent RetryNotice after Recent fails", async () => {
    const samples = deferred<SampleRoomCard[]>();
    const recentRooms = deferred<UploadedRoomCard[]>();
    const mounted = mountRooms(samples.promise, recentRooms.promise);

    samples.resolve([sample(1, "유지되는 샘플")]);
    recentRooms.reject(new Error("recent offline"));
    await flushPromises();
    const html = mounted.html();

    expect(html).toContain("유지되는 샘플");
    expect(html).toContain("이 브라우저에서 만든 방을 불러오지 못했습니다.");
    expect(html).not.toContain("공간을 불러오는 중...");

    mounted.unmount();
  });

  it("shows both RetryNotices and ends loading when both sources fail", async () => {
    const samples = deferred<SampleRoomCard[]>();
    const recentRooms = deferred<UploadedRoomCard[]>();
    const mounted = mountRooms(samples.promise, recentRooms.promise);

    samples.reject(new Error("sample offline"));
    recentRooms.reject(new Error("recent offline"));
    await flushPromises();
    const html = mounted.html();

    expect(html).toContain("공개 샘플을 불러오지 못했습니다.");
    expect(html).toContain("이 브라우저에서 만든 방을 불러오지 못했습니다.");
    expect(html).not.toContain("공간을 불러오는 중...");

    mounted.unmount();
  });

  it("retries Sample without hiding an already-rendered Recent card", async () => {
    const initialSamples = deferred<SampleRoomCard[]>();
    const retrySamples = deferred<SampleRoomCard[]>();
    const recentRooms = deferred<UploadedRoomCard[]>();
    const mounted = mountRooms(initialSamples.promise, recentRooms.promise, {
      sampleRetries: [retrySamples.promise],
    });

    initialSamples.reject(new Error("sample offline"));
    recentRooms.resolve([recent(2, "재시도 중 유지되는 최근 방")]);
    await flushPromises();
    mounted.retry("공개 샘플을 불러오지 못했습니다.");
    const retryingHtml = mounted.html();
    expect(retryingHtml).toContain("재시도 중 유지되는 최근 방");
    expect(retryingHtml).not.toContain("공간을 불러오는 중...");

    retrySamples.resolve([sample(1, "재시도된 샘플")]);
    await flushPromises();
    const finalHtml = mounted.html();
    expect(finalHtml).toContain("재시도된 샘플");
    expect(finalHtml).toContain("재시도 중 유지되는 최근 방");

    mounted.unmount();
  });

  it("retries Recent without hiding an already-rendered Sample card", async () => {
    const samples = deferred<SampleRoomCard[]>();
    const initialRecent = deferred<UploadedRoomCard[]>();
    const retryRecent = deferred<UploadedRoomCard[]>();
    const mounted = mountRooms(samples.promise, initialRecent.promise, {
      recentRetries: [retryRecent.promise],
    });

    samples.resolve([sample(1, "재시도 중 유지되는 샘플")]);
    initialRecent.reject(new Error("recent offline"));
    await flushPromises();
    mounted.retry("이 브라우저에서 만든 방을 불러오지 못했습니다.");
    const retryingHtml = mounted.html();
    expect(retryingHtml).toContain("재시도 중 유지되는 샘플");
    expect(retryingHtml).not.toContain("공간을 불러오는 중...");

    retryRecent.resolve([recent(2, "재시도된 최근 방")]);
    await flushPromises();
    const finalHtml = mounted.html();
    expect(finalHtml).toContain("재시도 중 유지되는 샘플");
    expect(finalHtml).toContain("재시도된 최근 방");

    mounted.unmount();
  });

  it("does not let an old unmounted response overwrite the latest mounted result", async () => {
    installStorage();
    const oldSamples = deferred<SampleRoomCard[]>();
    const oldRecent = deferred<UploadedRoomCard[]>();
    const newSamples = deferred<SampleRoomCard[]>();
    const newRecent = deferred<UploadedRoomCard[]>();
    vi.spyOn(roomsPageLoader, "loadSamples")
      .mockReturnValueOnce(oldSamples.promise)
      .mockReturnValueOnce(newSamples.promise);
    vi.spyOn(roomsPageLoader, "loadRecent")
      .mockReturnValueOnce(oldRecent.promise)
      .mockReturnValueOnce(newRecent.promise);

    const oldMount = createRoomsMount();
    oldMount.html();
    oldMount.unmount();
    const latestMount = createRoomsMount();
    latestMount.html();

    newSamples.resolve([sample(2, "최신 샘플")]);
    newRecent.resolve([recent(3, "최신 최근 방")]);
    await flushPromises();
    expect(latestMount.html()).toContain("최신 샘플");

    oldSamples.resolve([sample(1, "오래된 샘플")]);
    oldRecent.resolve([recent(4, "오래된 최근 방")]);
    await flushPromises();
    const afterStale = latestMount.html();
    expect(afterStale).toContain("최신 샘플");
    expect(afterStale).not.toContain("오래된 샘플");
    expect(oldMount.stateUpdatesAfterUnmount).toBe(0);

    latestMount.unmount();
  });

  it("runs effect cleanup so settled requests do not update state after unmount", async () => {
    const samples = deferred<SampleRoomCard[]>();
    const recentRooms = deferred<UploadedRoomCard[]>();
    const mounted = mountRooms(samples.promise, recentRooms.promise);

    mounted.unmount();
    samples.resolve([sample(1, "늦은 샘플")]);
    recentRooms.resolve([recent(2, "늦은 최근 방")]);
    await flushPromises();

    expect(mounted.stateUpdatesAfterUnmount).toBe(0);
  });
});

describe("Public sample selection card", () => {
  it("marks only the selected sample and keeps each roomId on its own card", () => {
    installStorage();
    const roomA = sample(1, "첫 번째 샘플");
    const roomB = sample(2, "두 번째 샘플");
    const first = renderToStaticMarkup(<div>
      <PublicRoomCard room={roomA} selected onSelect={() => undefined} />
      <PublicRoomCard room={roomB} selected={false} onSelect={() => undefined} />
    </div>);
    const second = renderToStaticMarkup(<div>
      <PublicRoomCard room={roomA} selected={false} onSelect={() => undefined} />
      <PublicRoomCard room={roomB} selected onSelect={() => undefined} />
    </div>);

    expect(first).toContain('aria-pressed="true" data-room-id="1"');
    expect(first).toContain('aria-pressed="false" data-room-id="2"');
    expect(second).toContain('aria-pressed="false" data-room-id="1"');
    expect(second).toContain('aria-pressed="true" data-room-id="2"');
    expect((second.match(/aria-pressed="true"/g) ?? [])).toHaveLength(1);
  });

  it("calls the sample selection handler exactly once per click", () => {
    installStorage();
    const onSelect = vi.fn();
    PublicRoomCard({ room: sample(7, "선택 샘플"), selected: false, onSelect }).props.onClick();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

function installStorage(additional: Record<string, string> = {}) {
  vi.stubGlobal("localStorage", memoryStorage({
    [BROWSER_CLIENT_ID_KEY]: BROWSER_ID,
    ...additional,
  }));
  vi.stubGlobal("sessionStorage", memoryStorage());
  vi.stubGlobal("window", {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    confirm: vi.fn(() => true),
  });
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function sample(roomId: number, title: string): SampleRoomCard {
  return {
    roomId,
    title,
    size: "12㎡",
    tone: "white",
    category: "원룸",
    layoutId: `api-room-${roomId}`,
    layout: {
      id: `api-room-${roomId}`,
      name: title,
      width: 4,
      depth: 3,
      source: "SAMPLE",
      walls: [],
      doors: [],
      windows: [],
      furniture: [],
    },
  };
}

function recent(roomId: number, title: string): UploadedRoomCard {
  return {
    ...sample(roomId, title),
    source: "UPLOAD",
    createdAt: "2026-07-20T00:00:00Z",
    dimensions: "4m × 3m",
  };
}

interface MountOptions {
  sampleRetries?: Promise<SampleRoomCard[]>[];
  recentRetries?: Promise<UploadedRoomCard[]>[];
}

function mountRooms(
  samples: Promise<SampleRoomCard[]>,
  recentRooms: Promise<UploadedRoomCard[]>,
  options: MountOptions = {},
) {
  installStorage();
  vi.spyOn(roomsPageLoader, "loadSamples")
    .mockReturnValueOnce(samples)
    .mockImplementation(() => options.sampleRetries?.shift() ?? Promise.resolve([]));
  vi.spyOn(roomsPageLoader, "loadRecent")
    .mockReturnValueOnce(recentRooms)
    .mockImplementation(() => options.recentRetries?.shift() ?? Promise.resolve([]));
  const mounted = createRoomsMount();
  mounted.html();
  return mounted;
}

function createRoomsMount() {
  const runtime = new HookRuntime();
  let tree: ReactElement | null = null;
  return {
    html() {
      tree = runtime.render(() => Rooms());
      runtime.commitEffects();
      return renderToStaticMarkup(tree);
    },
    retry(message: string) {
      tree = runtime.render(() => Rooms());
      runtime.commitEffects();
      const notice = findElement(tree, (element) => {
        if (typeof element.type !== "function" || element.type.name !== "RetryNotice") return false;
        return (element.props as { message?: string }).message === message;
      });
      if (!notice) throw new Error(`RetryNotice not found: ${message}`);
      (notice.props as { onRetry(): void }).onRetry();
    },
    unmount() {
      runtime.unmount();
    },
    get stateUpdatesAfterUnmount() {
      return runtime.stateUpdatesAfterUnmount;
    },
  };
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement) => boolean,
): ReactElement | null {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findElement(child, predicate);
        if (found) return found;
      }
    }
    return null;
  }
  if (predicate(node)) return node;
  return findElement((node.props as { children?: ReactNode }).children, predicate);
}

function occurrences(value: string, term: string) {
  return value.split(term).length - 1;
}

async function flushPromises() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

type HookSlot = StateSlot | RefSlot | MemoSlot | EffectSlot;
interface StateSlot { kind: "state"; value: unknown }
interface RefSlot { kind: "ref"; value: { current: unknown } }
interface MemoSlot { kind: "memo"; value: unknown; dependencies?: DependencyList }
interface EffectSlot {
  kind: "effect";
  dependencies?: DependencyList;
  effect: EffectCallback;
  cleanup?: () => void;
  pending: boolean;
}

class HookRuntime {
  private slots: HookSlot[] = [];
  private cursor = 0;
  private mounted = true;
  stateUpdatesAfterUnmount = 0;

  useState<T>(initial: T | (() => T)): [T, (next: SetStateAction<T>) => void] {
    const index = this.cursor;
    this.cursor += 1;
    if (!this.slots[index]) {
      this.slots[index] = {
        kind: "state",
        value: typeof initial === "function" ? (initial as () => T)() : initial,
      };
    }
    const slot = this.slots[index] as StateSlot;
    return [slot.value as T, (next) => {
      if (!this.mounted) {
        this.stateUpdatesAfterUnmount += 1;
        return;
      }
      slot.value = typeof next === "function"
        ? (next as (current: T) => T)(slot.value as T)
        : next;
    }];
  }

  useRef<T>(initial: T): { current: T } {
    const index = this.cursor;
    this.cursor += 1;
    if (!this.slots[index]) this.slots[index] = { kind: "ref", value: { current: initial } };
    return (this.slots[index] as RefSlot).value as { current: T };
  }

  useMemo<T>(factory: () => T, dependencies?: DependencyList): T {
    const index = this.cursor;
    this.cursor += 1;
    const current = this.slots[index] as MemoSlot | undefined;
    if (!current || !sameDependencies(current.dependencies, dependencies)) {
      this.slots[index] = { kind: "memo", value: factory(), dependencies };
    }
    return (this.slots[index] as MemoSlot).value as T;
  }

  useEffect(effect: EffectCallback, dependencies?: DependencyList) {
    const index = this.cursor;
    this.cursor += 1;
    const current = this.slots[index] as EffectSlot | undefined;
    if (!current) {
      this.slots[index] = { kind: "effect", dependencies, effect, pending: true };
      return;
    }
    if (!sameDependencies(current.dependencies, dependencies)) {
      current.dependencies = dependencies;
      current.effect = effect;
      current.pending = true;
    }
  }

  render(factory: () => ReactElement): ReactElement {
    this.cursor = 0;
    hookRuntimeRef.current = this;
    try {
      return factory();
    } finally {
      hookRuntimeRef.current = null;
    }
  }

  commitEffects() {
    for (const slot of this.slots) {
      if (slot.kind !== "effect" || !slot.pending) continue;
      slot.cleanup?.();
      const cleanup = slot.effect();
      slot.cleanup = typeof cleanup === "function" ? cleanup : undefined;
      slot.pending = false;
    }
  }

  unmount() {
    if (!this.mounted) return;
    this.mounted = false;
    for (const slot of this.slots) {
      if (slot.kind === "effect") slot.cleanup?.();
    }
  }
}

function sameDependencies(left?: DependencyList, right?: DependencyList) {
  if (!left || !right || left.length !== right.length) return left === right;
  return left.every((value, index) => Object.is(value, right[index]));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
