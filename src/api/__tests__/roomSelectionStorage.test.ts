// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  commitStagedSelectedRoomEnvelope,
  readSelectedRoomEnvelope,
  stageSelectedRoomEnvelope,
  type SelectedRoomEnvelope,
} from "../roomSelectionStorage";
import { safeStorageGet, safeStorageRemove, safeStorageSet } from "../safeStorage";
import { readLayoutSessionResult } from "../layoutSession";
import { makeLayout } from "./layoutTestFixtures";

describe("selected Room storage boundary", () => {
  let storage: ThrowingStorage;

  beforeEach(() => {
    storage = new ThrowingStorage();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  });

  it("returns typed storage errors instead of throwing from get, set, and remove", () => {
    storage.throwGet = true;
    expect(safeStorageGet("local", "key").status).toBe("storage-error");
    storage.throwGet = false;
    storage.throwSet = true;
    expect(safeStorageSet("local", "key", "value").status).toBe("storage-error");
    storage.throwSet = false;
    storage.throwRemove = true;
    expect(safeStorageRemove("local", "key").status).toBe("storage-error");
  });

  it("keeps the previous authoritative selection when staged commit storage fails", () => {
    const previous = makeSelection(3, "room-3");
    stageSelectedRoomEnvelope(previous);
    commitStagedSelectedRoomEnvelope(previous);

    const next = makeSelection(4, "room-4");
    stageSelectedRoomEnvelope(next);
    storage.failSetKey = "roomfit:selectedRoom:v1";
    expect(() => commitStagedSelectedRoomEnvelope(next)).toThrow("could not be committed");
    expect(readSelectedRoomEnvelope()).toEqual({ status: "valid", selection: previous });
  });

  it("distinguishes missing, invalid, and inaccessible Layout session storage", () => {
    expect(readLayoutSessionResult()).toEqual({ status: "missing" });

    storage.setItem("roomfit:layoutSession:v1", "not-json");
    expect(readLayoutSessionResult()).toEqual({ status: "invalid" });

    storage.throwGet = true;
    expect(readLayoutSessionResult().status).toBe("storage-error");
  });
});

function makeSelection(backendRoomId: number, uiRoomLayoutId: string): SelectedRoomEnvelope {
  return {
    version: 1,
    backendRoomId,
    uiRoomLayoutId,
    title: `Room ${backendRoomId}`,
    category: "원룸",
    size: "20㎡",
    roomLayout: { ...makeLayout(), id: uiRoomLayoutId },
  };
}

class ThrowingStorage implements Storage {
  private readonly values = new Map<string, string>();
  throwGet = false;
  throwSet = false;
  throwRemove = false;
  failSetKey: string | null = null;

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    if (this.throwGet) throw new Error("get failed");
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    if (this.throwRemove) throw new Error("remove failed");
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.throwSet || key === this.failSetKey) throw new Error("set failed");
    this.values.set(key, value);
  }
}
