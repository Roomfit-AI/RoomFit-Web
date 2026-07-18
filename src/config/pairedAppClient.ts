import { normalizeClientId } from "./clientScope";

export const PAIRED_APP_CLIENT_ID_KEY = "roomfit:pairedAppClientId:v1";

type PairedAppStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function getPairedAppClientId(
  storage: PairedAppStorage = localStorage,
): string | null {
  try {
    const raw = storage.getItem(PAIRED_APP_CLIENT_ID_KEY);
    const clientId = normalizeClientId(raw);
    if (raw && !clientId) storage.removeItem(PAIRED_APP_CLIENT_ID_KEY);
    return clientId;
  } catch {
    return null;
  }
}

export function savePairedAppClientId(
  value: unknown,
  storage: PairedAppStorage = localStorage,
): string {
  const clientId = normalizeClientId(value);
  if (!clientId) throw new Error("유효하지 않은 RoomFit Scan 연결 정보입니다.");
  storage.setItem(PAIRED_APP_CLIENT_ID_KEY, clientId);
  return clientId;
}

export function clearPairedAppClientId(
  storage: Pick<PairedAppStorage, "removeItem"> = localStorage,
): void {
  storage.removeItem(PAIRED_APP_CLIENT_ID_KEY);
}
