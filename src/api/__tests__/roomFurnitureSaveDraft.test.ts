import { describe, expect, it } from "vitest";

import { parsePersistedRoomFurnitureSaveDraft } from "../roomFurnitureSaveDraft";
import { makeLayout } from "./layoutTestFixtures";

describe("Room furniture save draft schema", () => {
  it("rejects an invalid updatedAt timestamp", () => {
    expect(parsePersistedRoomFurnitureSaveDraft(JSON.stringify({
      ...makeDraft(),
      updatedAt: "today",
    }))).toBeNull();
  });

  it("rejects duplicate furniture IDs", () => {
    const draft = makeDraft();
    draft.snapshot.furniture = [draft.snapshot.furniture[0], { ...draft.snapshot.furniture[0] }];
    expect(parsePersistedRoomFurnitureSaveDraft(JSON.stringify(draft))).toBeNull();
  });

  it("rejects non-finite position and dimension values", () => {
    const invalidPosition = makeDraft();
    invalidPosition.snapshot.furniture[0].position.x = Number.NaN;
    const invalidDimension = makeDraft();
    invalidDimension.snapshot.furniture[0].dimensions.width = Number.POSITIVE_INFINITY;

    expect(parsePersistedRoomFurnitureSaveDraft(JSON.stringify(invalidPosition))).toBeNull();
    expect(parsePersistedRoomFurnitureSaveDraft(JSON.stringify(invalidDimension))).toBeNull();
  });

  it("rejects invalid owner IDs", () => {
    expect(parsePersistedRoomFurnitureSaveDraft(JSON.stringify({
      ...makeDraft(),
      ownerBackendRoomId: "3",
    }))).toBeNull();
  });

  it("rejects a null snapshot without throwing", () => {
    expect(() => parsePersistedRoomFurnitureSaveDraft(JSON.stringify({
      ...makeDraft(),
      snapshot: null,
    }))).not.toThrow();
    expect(parsePersistedRoomFurnitureSaveDraft(JSON.stringify({
      ...makeDraft(),
      snapshot: null,
    }))).toBeNull();
  });
});

function makeDraft() {
  return {
    version: 1 as const,
    ownerBackendRoomId: 3,
    ownerUiRoomLayoutId: "room-3",
    revision: 1,
    dirty: true as const,
    updatedAt: "2026-07-17T00:00:00.000Z",
    snapshot: makeLayout(),
  };
}
