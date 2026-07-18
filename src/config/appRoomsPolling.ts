import type { UploadedRoomCard } from "../api/rooms";

export const APP_ROOMS_POLL_INTERVAL_MS = 5000;

interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", listener: EventListener): void;
  removeEventListener(type: "visibilitychange", listener: EventListener): void;
}

interface AppRoomsPollingOptions {
  clientId: string | null;
  loadRooms(clientId: string, signal: AbortSignal): Promise<UploadedRoomCard[]>;
  onSuccess(rooms: UploadedRoomCard[], context: { initial: boolean }): void;
  onError(error: unknown, context: { initial: boolean }): void;
  visibilitySource?: VisibilitySource;
  intervalMs?: number;
}

export interface AppRoomsPollingController {
  refresh(): void;
  stop(): void;
}

export function startAppRoomsPolling({
  clientId,
  loadRooms,
  onSuccess,
  onError,
  visibilitySource = document,
  intervalMs = APP_ROOMS_POLL_INTERVAL_MS,
}: AppRoomsPollingOptions): AppRoomsPollingController {
  if (!clientId) return { refresh() {}, stop() {} };

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeRequest: AbortController | null = null;
  let initialRequestFinished = false;

  const clearTimer = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const scheduleNext = () => {
    if (stopped || activeRequest || visibilitySource.visibilityState !== "visible") return;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void requestRooms();
    }, intervalMs);
  };

  const requestRooms = async () => {
    if (stopped || activeRequest || visibilitySource.visibilityState !== "visible") return;

    clearTimer();
    const controller = new AbortController();
    const initial = !initialRequestFinished;
    activeRequest = controller;

    try {
      const rooms = await loadRooms(clientId, controller.signal);
      if (stopped || activeRequest !== controller || controller.signal.aborted) return;
      onSuccess(rooms, { initial });
    } catch (error) {
      if (stopped || activeRequest !== controller || controller.signal.aborted) return;
      onError(error, { initial });
    } finally {
      if (activeRequest === controller) {
        activeRequest = null;
        initialRequestFinished = true;
        scheduleNext();
      }
    }
  };

  const pause = () => {
    clearTimer();
    const request = activeRequest;
    activeRequest = null;
    request?.abort();
  };

  const handleVisibilityChange: EventListener = () => {
    if (visibilitySource.visibilityState === "hidden") {
      pause();
      return;
    }
    clearTimer();
    void requestRooms();
  };

  visibilitySource.addEventListener("visibilitychange", handleVisibilityChange);
  if (visibilitySource.visibilityState === "visible") void requestRooms();

  return {
    refresh() {
      if (stopped || visibilitySource.visibilityState !== "visible") return;
      clearTimer();
      void requestRooms();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      pause();
      visibilitySource.removeEventListener("visibilitychange", handleVisibilityChange);
    },
  };
}
