import { describe, expect, it } from "vitest";

import { parsePersistedLayoutSaveDraft, type PersistedLayoutSaveDraft } from "../layoutSaveDraft";
import { TEST_SESSION, makeLayout } from "./layoutTestFixtures";

describe("parsePersistedLayoutSaveDraft", () => {
  it("accepts a complete valid draft", () => {
    expect(parsePersistedLayoutSaveDraft(JSON.stringify(makeDraft()))).toMatchObject({
      layoutId: TEST_SESSION.layoutId,
      ownerBackendRoomId: TEST_SESSION.ownerBackendRoomId,
      dirty: true,
    });
  });

  it.each([
    ["null furniture", (draft: PersistedLayoutSaveDraft) => {
      (draft.roomLayout.furniture as unknown[]) = [null];
    }],
    ["duplicate furniture IDs", (draft: PersistedLayoutSaveDraft) => {
      draft.roomLayout.furniture[1].id = draft.roomLayout.furniture[0].id;
    }],
    ["NaN position", (draft: PersistedLayoutSaveDraft) => {
      draft.roomLayout.furniture[0].position.x = Number.NaN;
    }],
    ["Infinity rotation", (draft: PersistedLayoutSaveDraft) => {
      draft.roomLayout.furniture[0].rotationY = Number.POSITIVE_INFINITY;
    }],
    ["unknown status", (draft: PersistedLayoutSaveDraft) => {
      draft.roomLayout.furniture[0].status = "unknown" as never;
    }],
    ["invalid ISO date", (draft: PersistedLayoutSaveDraft) => {
      draft.updatedAt = "2026-07-16";
    }],
  ])("rejects %s", (_label, mutate) => {
    const draft = makeDraft();
    mutate(draft);
    expect(parsePersistedLayoutSaveDraft(JSON.stringify(draft))).toBeNull();
  });
});

function makeDraft(): PersistedLayoutSaveDraft {
  return {
    ...TEST_SESSION,
    version: 2,
    revision: 1,
    dirty: true,
    updatedAt: "2026-07-16T00:00:00.000Z",
    roomLayout: makeLayout(),
  };
}
