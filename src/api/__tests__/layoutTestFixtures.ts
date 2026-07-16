import type { LayoutResponse } from "../layouts";
import type {
  LayoutSaveDraftReadResult,
  LayoutSaveDraftStore,
  PersistedLayoutSaveDraft,
} from "../layoutSaveDraft";
import type { LayoutSession } from "../layoutSession";
import type { Furniture, RoomLayout } from "../../types";

export const TEST_SESSION: LayoutSession = {
  version: 1,
  layoutId: 7,
  ownerBackendRoomId: 3,
  ownerUiRoomLayoutId: "room-3",
};

export function makeLayout(positionX = 0, furnitureIds = ["desk-1", "chair-1"]): RoomLayout {
  return {
    id: TEST_SESSION.ownerUiRoomLayoutId,
    name: "Test Room",
    width: 4,
    depth: 5,
    height: 2.4,
    walls: [],
    doors: [],
    windows: [],
    furniture: furnitureIds.map((id, index) => makeFurniture(id, positionX + index)),
  };
}

export function makeFurniture(id: string, positionX = 0): Furniture {
  return {
    id,
    name: id,
    category: id.includes("chair") ? "chair" : "desk",
    dimensions: { width: 1.2, depth: 0.6, height: 0.74 },
    position: { x: positionX, z: 0 },
    rotationY: 0,
    color: "#ffffff",
    material: "wood",
    status: "recommended",
    removable: true,
  };
}

export function makeLayoutResponse(ids = ["desk-1", "chair-1"]): LayoutResponse {
  return {
    layoutId: TEST_SESSION.layoutId,
    status: "SUCCESS",
    recommendedFurniture: ids.map((id) => ({
      id,
      type: id.includes("chair") ? "chair" : "desk",
      label: id,
      width: 1.2,
      depth: 0.6,
      height: 0.74,
      position: { x: 2, z: 2 },
      rotation: 0,
      status: "RECOMMENDED",
      productId: null,
      styleTags: [],
    })),
    scoreSummary: {
      collisionScore: 100,
      boundaryScore: 100,
      doorWindowScore: 100,
      pathScore: 100,
      goalScore: 100,
      styleScore: 100,
      totalScore: 100,
    },
    validationResult: {
      collisionFree: true,
      boundaryValid: true,
      doorClearance: true,
      windowClearance: true,
      pathSecured: true,
      warnings: [],
    },
  };
}

export class MemoryDraftStore implements LayoutSaveDraftStore {
  draft: PersistedLayoutSaveDraft | null = null;
  invalid = false;
  saveError: Error | null = null;
  removeError: Error | null = null;

  read(): LayoutSaveDraftReadResult {
    if (this.invalid) {
      this.invalid = false;
      this.draft = null;
      return { status: "discarded-invalid" };
    }
    return this.draft
      ? { status: "valid", draft: structuredClone(this.draft) }
      : { status: "none" };
  }

  save(draft: PersistedLayoutSaveDraft): void {
    if (this.saveError) {
      throw this.saveError;
    }
    this.draft = structuredClone(draft);
  }

  remove(expectedRevision?: number): void {
    if (this.removeError) {
      throw this.removeError;
    }
    if (expectedRevision !== undefined && this.draft?.revision !== expectedRevision) {
      return;
    }
    this.draft = null;
  }
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
