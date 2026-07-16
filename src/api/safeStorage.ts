export type StorageArea = "local" | "session";

export type StorageReadResult =
  | { status: "success"; value: string }
  | { status: "missing" }
  | { status: "storage-error"; error: Error };

export type StorageWriteResult =
  | { status: "success" }
  | { status: "storage-error"; error: Error };

export type StorageKeysResult =
  | { status: "success"; keys: string[] }
  | { status: "storage-error"; error: Error };

export function safeStorageGet(area: StorageArea, key: string): StorageReadResult {
  try {
    const value = resolveStorage(area).getItem(key);
    return value === null ? { status: "missing" } : { status: "success", value };
  } catch (error) {
    return { status: "storage-error", error: toError(error) };
  }
}

export function safeStorageSet(area: StorageArea, key: string, value: string): StorageWriteResult {
  try {
    resolveStorage(area).setItem(key, value);
    return { status: "success" };
  } catch (error) {
    return { status: "storage-error", error: toError(error) };
  }
}

export function safeStorageRemove(area: StorageArea, key: string): StorageWriteResult {
  try {
    resolveStorage(area).removeItem(key);
    return { status: "success" };
  } catch (error) {
    return { status: "storage-error", error: toError(error) };
  }
}

export function safeStorageKeys(area: StorageArea): StorageKeysResult {
  try {
    const storage = resolveStorage(area);
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null) {
        keys.push(key);
      }
    }
    return { status: "success", keys };
  } catch (error) {
    return { status: "storage-error", error: toError(error) };
  }
}

export function requireStorageWrite(result: StorageWriteResult, message: string): void {
  if (result.status === "storage-error") {
    throw new Error(message, { cause: result.error });
  }
}

function resolveStorage(area: StorageArea): Storage {
  return area === "local" ? globalThis.localStorage : globalThis.sessionStorage;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
