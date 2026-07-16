// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import type { Furniture, RoomLayout, Vector2D } from "../../types";

const roomApiMocks = vi.hoisted(() => ({
  updateRoomFurniture: vi.fn(),
  getSampleRoomLayouts: vi.fn(),
  getSampleRooms: vi.fn(),
  getRecentUploadedRooms: vi.fn(),
  deleteUploadedRoom: vi.fn(),
}));
const layoutApiMocks = vi.hoisted(() => ({
  confirmLayout: vi.fn(),
}));

vi.mock("../../api/rooms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/rooms")>();
  return {
    ...actual,
    ...roomApiMocks,
  };
});

vi.mock("../../api/layouts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/layouts")>();
  return {
    ...actual,
    confirmLayout: layoutApiMocks.confirmLayout,
  };
});

interface MockRoomViewerProps {
  furniture: Furniture[];
  onMoveFurniture: (id: string, position: Vector2D) => void;
}

vi.mock("../../components/room/RoomViewer", () => {
  const MockRoomViewer = ({ furniture, onMoveFurniture }: MockRoomViewerProps) => (
    <div>
      <span data-testid="first-furniture-x">{furniture[0]?.position.x ?? "none"}</span>
      {furniture[0] && (
        <>
          <button type="button" onClick={() => onMoveFurniture(furniture[0].id, { x: 1, z: 0 })}>
            move-first
          </button>
          <button type="button" onClick={() => onMoveFurniture(furniture[0].id, { x: 3, z: 0 })}>
            move-latest
          </button>
        </>
      )}
    </div>
  );
  return { RoomViewer: MockRoomViewer, default: MockRoomViewer };
});

import {
  beginLayoutConfirmAttempt,
  clearLayoutConfirmAttemptForOwner,
  markLayoutConfirmAttemptConfirmed,
  readLayoutConfirmAttempt,
  isLayoutSessionConfirmPending,
} from "../../api/layoutConfirmation";
import {
  clearActiveLayoutSaveState,
  getActiveLayoutSaveState,
  setActiveLayoutSession,
} from "../../api/layoutSaveCoordinator";
import {
  clearActiveRoomFurnitureSaveState,
  enqueueActiveRoomFurnitureSave,
  flushActiveRoomFurnitureSave,
  getActiveRoomFurnitureSaveState,
  retryActiveRoomFurnitureSave,
  setActiveRoomFurnitureSaveSession,
} from "../../api/roomFurnitureSaveCoordinator";
import {
  readLayoutSession,
  writeLayoutSession,
} from "../../api/layoutSession";
import { readSelectedRoomEnvelope } from "../../api/roomSelectionStorage";
import {
  beginActiveLayoutWorkflow,
  endActiveLayoutWorkflow,
  type ActiveLayoutWorkflowToken,
} from "../../api/layoutWorkflow";
import { deferred, makeLayout, TEST_SESSION } from "../../api/__tests__/layoutTestFixtures";
import Navbar from "../../components/ui/Navbar";
import EditorPlaceholder from "../EditorPlaceholder";
import LayoutConfirm from "../LayoutConfirm";
import ManageFurniture from "../ManageFurniture";
import Rooms from "../Rooms";

const TEST_ROOM = makeLayout();
const TEST_ROOM_CARD = {
  roomId: TEST_SESSION.ownerBackendRoomId,
  title: TEST_ROOM.name,
  size: "20㎡",
  tone: "white",
  category: "원룸",
  layoutId: TEST_ROOM.id,
  layout: TEST_ROOM,
};

describe("layout persistence UI integration", () => {
  let workflowToken: ActiveLayoutWorkflowToken | null = null;

  beforeEach(() => {
    installTestStorage();
    roomApiMocks.updateRoomFurniture.mockReset().mockResolvedValue(undefined);
    roomApiMocks.getSampleRoomLayouts.mockReset().mockResolvedValue([TEST_ROOM]);
    roomApiMocks.getSampleRooms.mockReset().mockResolvedValue([TEST_ROOM_CARD]);
    roomApiMocks.getRecentUploadedRooms.mockReset().mockResolvedValue([]);
    roomApiMocks.deleteUploadedRoom.mockReset().mockResolvedValue(undefined);
    layoutApiMocks.confirmLayout.mockReset().mockResolvedValue({
      layoutId: TEST_SESSION.layoutId,
      confirmed: true,
      confirmedAt: "2026-07-17T00:00:00.000Z",
    });
    seedSelectedRoom();
  });

  afterEach(async () => {
    if (workflowToken) {
      endActiveLayoutWorkflow(workflowToken);
      workflowToken = null;
    }
    vi.restoreAllMocks();
    cleanup();

    if (getActiveRoomFurnitureSaveState().hasPending) {
      roomApiMocks.updateRoomFurniture.mockReset().mockResolvedValue(undefined);
      await retryActiveRoomFurnitureSave().catch(() => undefined);
    }
    try {
      clearActiveRoomFurnitureSaveState();
    } catch {
      // A failing assertion may leave an unresolved transport; later tests run
      // in a fresh Vitest worker when this cleanup cannot complete.
    }
    try {
      clearActiveLayoutSaveState();
    } catch {
      // Same isolation guard as the Room coordinator above.
    }
    clearLayoutConfirmAttemptForOwner(TEST_SESSION.ownerBackendRoomId);
    localStorage.clear();
    sessionStorage.clear();
  });

  it("serializes rapid ManageFurniture edits and persists the latest snapshot", async () => {
    const firstRequest = deferred<void>();
    const secondRequest = deferred<void>();
    roomApiMocks.updateRoomFurniture
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);

    render(<ManageFurniture />);
    await waitUntilManageIsReady();
    fireEvent.click(screen.getByRole("button", { name: "move-first" }));
    fireEvent.click(screen.getByRole("button", { name: "move-latest" }));

    expect(roomApiMocks.updateRoomFurniture).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("first-furniture-x").textContent).toBe("3");

    await act(async () => {
      firstRequest.resolve(undefined);
      await vi.waitFor(() => expect(roomApiMocks.updateRoomFurniture).toHaveBeenCalledTimes(2));
    });
    expect(roomApiMocks.updateRoomFurniture.mock.calls[1][1][0].position.x).toBe(3);

    await act(async () => {
      secondRequest.resolve(undefined);
      await flushActiveRoomFurnitureSave();
    });
    const mirrored = JSON.parse(localStorage.getItem("roomfit:selectedRoomLayout") ?? "null") as RoomLayout;
    expect(mirrored.furniture[0].position.x).toBe(3);
  });

  it("keeps an enqueued Room PUT alive after ManageFurniture unmount", async () => {
    const request = deferred<void>();
    roomApiMocks.updateRoomFurniture.mockImplementationOnce(() => request.promise);
    const view = render(<ManageFurniture />);
    await waitUntilManageIsReady();
    fireEvent.click(screen.getByRole("button", { name: "move-first" }));

    view.unmount();
    expect(roomApiMocks.updateRoomFurniture).toHaveBeenCalledTimes(1);
    await act(async () => {
      request.resolve(undefined);
      await flushActiveRoomFurnitureSave();
    });
    expect(getActiveRoomFurnitureSaveState().hasPending).toBe(false);
  });

  it("retains failed ManageFurniture work and clears the old Layout only after retry succeeds", async () => {
    writeLayoutSession(TEST_SESSION);
    roomApiMocks.updateRoomFurniture
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);

    render(<ManageFurniture />);
    await waitUntilManageIsReady();
    fireEvent.click(screen.getByRole("button", { name: "move-first" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("저장하지 못했습니다"));
    expect(getActiveRoomFurnitureSaveState().hasPending).toBe(true);
    expect(readLayoutSession()).toEqual(TEST_SESSION);
    expect(screen.getByTestId("first-furniture-x").textContent).toBe("1");

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(getActiveRoomFurnitureSaveState().hasPending).toBe(false));
    await waitFor(() => expect(readLayoutSession()).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks Navbar home, previous, and next while another workflow is active", async () => {
    workflowToken = beginActiveLayoutWorkflow("feedback", null);
    render(
      <MemoryRouter initialEntries={["/editor"]}>
        <Navbar />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "ROOMFIT" }));
    fireEvent.click(screen.getByRole("button", { name: "이전 단계" }));
    fireEvent.click(screen.getByRole("button", { name: "다음 단계" }));
    expect(screen.getByTestId("location").textContent).toBe("/editor");
  });

  it("waits for the active Room save before Navbar navigation", async () => {
    const request = deferred<void>();
    roomApiMocks.updateRoomFurniture.mockImplementationOnce(() => request.promise);
    setActiveRoomFurnitureSaveSession({
      ownerBackendRoomId: TEST_SESSION.ownerBackendRoomId,
      ownerUiRoomLayoutId: TEST_ROOM.id,
    });
    enqueueActiveRoomFurnitureSave({
      ...TEST_ROOM,
      furniture: TEST_ROOM.furniture.map((item, index) => index === 0
        ? { ...item, position: { x: 2, z: 0 } }
        : item),
    });

    render(
      <MemoryRouter initialEntries={["/manage-furniture"]}>
        <Navbar />
        <LocationProbe />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /저장 중|다음 단계/ }));
    expect(screen.getByTestId("location").textContent).toBe("/manage-furniture");

    await act(async () => {
      request.resolve(undefined);
    });
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/preference"));
  });

  it("keeps Navbar on the current route after Room save failure and navigates after retry", async () => {
    roomApiMocks.updateRoomFurniture
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("still offline"))
      .mockResolvedValueOnce(undefined);
    setActiveRoomFurnitureSaveSession({
      ownerBackendRoomId: TEST_SESSION.ownerBackendRoomId,
      ownerUiRoomLayoutId: TEST_ROOM.id,
    });
    enqueueActiveRoomFurnitureSave(TEST_ROOM);
    await expect(flushActiveRoomFurnitureSave()).rejects.toThrow("offline");

    render(
      <MemoryRouter initialEntries={["/manage-furniture"]}>
        <Navbar />
        <LocationProbe />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "저장 재시도" }));
    await screen.findByRole("alert");
    expect(screen.getByTestId("location").textContent).toBe("/manage-furniture");

    await userEvent.click(screen.getByRole("button", { name: "저장 재시도" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/preference"));
  });

  it("does not reactivate a matching confirmed session when the same Room is selected", async () => {
    writeLayoutSession(TEST_SESSION);
    setActiveLayoutSession(TEST_SESSION);
    beginLayoutConfirmAttempt(TEST_SESSION);
    markLayoutConfirmAttemptConfirmed(TEST_SESSION);

    render(<Rooms />);
    const roomButton = await screen.findByRole("button", { name: new RegExp(TEST_ROOM.name) });
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    vi.spyOn(localStorage, "removeItem").mockImplementation((key: string) => {
      if (key === "roomfit:layoutSession:v1" || key === "roomfit:activeLayoutSaveDraft:v2") {
        throw new Error("storage unavailable");
      }
      return originalRemoveItem(key);
    });

    await userEvent.click(roomButton);
    await waitFor(() => expect(getActiveLayoutSaveState().session).toBeNull());
    expect(readLayoutConfirmAttempt()?.status).toBe("confirmed");
    expect(screen.queryByText(/다른 방으로 이동하지 않았습니다/)).toBeNull();
  });

  it("keeps Backend confirm success when the local confirmed copy cannot be saved", async () => {
    writeLayoutSession(TEST_SESSION);
    setActiveLayoutSession(TEST_SESSION);
    const originalSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key: string, value: string) => {
      if (key === "roomfit:confirmedLayoutsByRoomId") {
        throw new Error("quota");
      }
      return originalSetItem(key, value);
    });

    const firstView = renderConfirm();
    await userEvent.click(screen.getByRole("button", { name: "확정하기" }));
    await screen.findByText("최종 배치가 확정되었습니다");
    expect(screen.getByRole("status").textContent).toContain("일부 로컬 사본");
    expect(readLayoutConfirmAttempt()?.status).toBe("confirmed");

    firstView.unmount();
    renderConfirm();
    expect(screen.queryByRole("button", { name: "확정하기" })).toBeNull();
    expect(layoutApiMocks.confirmLayout).toHaveBeenCalledTimes(1);
  });

  it("keeps confirm success and recovery marker when local cleanup fails", async () => {
    writeLayoutSession(TEST_SESSION);
    setActiveLayoutSession(TEST_SESSION);
    const view = renderConfirm();
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    const removeSpy = vi.spyOn(localStorage, "removeItem").mockImplementation((key: string) => {
      if (
        key === "roomfit:layoutSession:v1"
        || key === "roomfit:activeLayoutSaveDraft:v2"
        || key === "roomfit:layoutConfirmAttempt:v1"
      ) {
        throw new Error("storage unavailable");
      }
      return originalRemoveItem(key);
    });

    await userEvent.click(screen.getByRole("button", { name: "확정하기" }));
    await screen.findByText("최종 배치가 확정되었습니다");
    expect(screen.getByRole("status").textContent).toContain("임시 저장 상태");
    expect(readLayoutConfirmAttempt()?.status).toBe("confirmed");

    removeSpy.mockRestore();
    view.unmount();
    renderConfirm();
    expect(screen.queryByRole("button", { name: "확정하기" })).toBeNull();
    expect(layoutApiMocks.confirmLayout).toHaveBeenCalledTimes(1);
  });

  it("keeps session and draft state when the confirm API fails", async () => {
    writeLayoutSession(TEST_SESSION);
    setActiveLayoutSession(TEST_SESSION);
    layoutApiMocks.confirmLayout.mockRejectedValueOnce(new Error("server error"));

    renderConfirm();
    await userEvent.click(screen.getByRole("button", { name: "확정하기" }));
    await waitFor(() => expect(screen.getByText(/배치를 저장하거나 확정하지 못했습니다/)).not.toBeNull());
    expect(readLayoutSession()).toEqual(TEST_SESSION);
    expect(screen.queryByText("최종 배치가 확정되었습니다")).toBeNull();
  });

  it("renders a safe Editor fallback when storage getters throw", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => render(<EditorPlaceholder />)).not.toThrow();
    expect(screen.getByText("선택된 방이 없습니다")).not.toBeNull();
  });

  it("renders Rooms safely and does not partially switch selection when storage access fails", async () => {
    const nextRoom = { ...makeLayout(), id: "room-4", name: "Next Room" };
    roomApiMocks.getSampleRooms.mockResolvedValueOnce([{
      ...TEST_ROOM_CARD,
      roomId: 4,
      title: nextRoom.name,
      layoutId: nextRoom.id,
      layout: nextRoom,
    }]);
    const originalGetItem = localStorage.getItem.bind(localStorage);
    vi.spyOn(localStorage, "getItem").mockImplementation((key: string) => {
      if (key === "roomfit:selectedRoom:v1") {
        throw new Error("storage unavailable");
      }
      return originalGetItem(key);
    });

    expect(() => render(<Rooms />)).not.toThrow();
    const nextRoomButton = await screen.findByRole("button", { name: /Next Room/ });
    await userEvent.click(nextRoomButton);
    await screen.findByText(/다른 방으로 이동하지 않았습니다/);
    expect(nextRoomButton.getAttribute("aria-pressed")).toBe("false");
    expect(roomApiMocks.updateRoomFurniture).not.toHaveBeenCalled();
  });

  it("keeps the previous React selection and Room owner when staged Room commit fails", async () => {
    const nextRoom = { ...makeLayout(), id: "room-4", name: "Next Room" };
    roomApiMocks.getSampleRooms.mockResolvedValueOnce([{
      ...TEST_ROOM_CARD,
      roomId: 4,
      title: nextRoom.name,
      layoutId: nextRoom.id,
      layout: nextRoom,
    }]);
    setActiveRoomFurnitureSaveSession({
      ownerBackendRoomId: TEST_SESSION.ownerBackendRoomId,
      ownerUiRoomLayoutId: TEST_ROOM.id,
    });
    const originalSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key: string, value: string) => {
      if (key === "roomfit:selectedRoom:v1") {
        throw new Error("quota");
      }
      return originalSetItem(key, value);
    });

    render(<Rooms />);
    const nextRoomButton = await screen.findByRole("button", { name: /Next Room/ });
    await userEvent.click(nextRoomButton);
    await screen.findByText(/다른 방으로 이동하지 않았습니다/);

    expect(nextRoomButton.getAttribute("aria-pressed")).toBe("false");
    expect(readSelectedRoomEnvelope()).toMatchObject({
      status: "valid",
      selection: { backendRoomId: TEST_SESSION.ownerBackendRoomId, uiRoomLayoutId: TEST_ROOM.id },
    });
    expect(getActiveRoomFurnitureSaveState().session).toEqual({
      ownerBackendRoomId: TEST_SESSION.ownerBackendRoomId,
      ownerUiRoomLayoutId: TEST_ROOM.id,
    });
  });

  it("keeps the new authoritative Room selected when preference storage cannot be read", async () => {
    const nextRoom = { ...makeLayout(), id: "room-4", name: "Next Room" };
    roomApiMocks.getSampleRooms.mockResolvedValueOnce([makeRoomCard(4, nextRoom)]);
    setActiveRoomFurnitureSaveSession({
      ownerBackendRoomId: TEST_SESSION.ownerBackendRoomId,
      ownerUiRoomLayoutId: TEST_ROOM.id,
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const originalGetItem = localStorage.getItem.bind(localStorage);
    vi.spyOn(localStorage, "getItem").mockImplementation((key: string) => {
      if (key === "roomfit:preferencesByRoomId") {
        throw new Error("preferences unavailable");
      }
      return originalGetItem(key);
    });

    render(<Rooms />);
    const nextRoomButton = await screen.findByRole("button", { name: /Next Room/ });
    await userEvent.click(nextRoomButton);
    await waitFor(() => expect(nextRoomButton.getAttribute("aria-pressed")).toBe("true"));

    expect(readSelectedRoomEnvelope()).toMatchObject({
      status: "valid",
      selection: { backendRoomId: 4, uiRoomLayoutId: nextRoom.id },
    });
    expect(getActiveRoomFurnitureSaveState().session).toEqual({
      ownerBackendRoomId: 4,
      ownerUiRoomLayoutId: nextRoom.id,
    });
    expect(screen.queryByText(/다른 방으로 이동하지 않았습니다/)).toBeNull();
  });

  it("keeps Room selection successful when preference mirrors cannot be written", async () => {
    const nextRoom = { ...makeLayout(), id: "room-4", name: "Next Room" };
    roomApiMocks.getSampleRooms.mockResolvedValueOnce([makeRoomCard(4, nextRoom)]);
    localStorage.setItem("roomfit:preferencesByRoomId", JSON.stringify({
      [nextRoom.id]: {
        purpose: "study",
        palette: "white",
        style: "modern",
        additionalFurnitureIds: ["chair-01"],
      },
    }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const preferenceMirrorKeys = new Set([
      "roomfit:selectedPurpose",
      "roomfit:selectedPalette",
      "roomfit:selectedStyle",
      "roomfit:selectedAdditionalFurnitureIds",
    ]);
    vi.spyOn(localStorage, "setItem").mockImplementation((key: string, value: string) => {
      if (preferenceMirrorKeys.has(key)) {
        throw new Error("preference mirror unavailable");
      }
      return originalSetItem(key, value);
    });

    render(<Rooms />);
    const nextRoomButton = await screen.findByRole("button", { name: /Next Room/ });
    await userEvent.click(nextRoomButton);
    await waitFor(() => expect(nextRoomButton.getAttribute("aria-pressed")).toBe("true"));

    expect(readSelectedRoomEnvelope()).toMatchObject({
      status: "valid",
      selection: { backendRoomId: 4, uiRoomLayoutId: nextRoom.id },
    });
    expect(getActiveRoomFurnitureSaveState().session).toEqual({
      ownerBackendRoomId: 4,
      ownerUiRoomLayoutId: nextRoom.id,
    });
    expect(screen.queryByText(/다른 방으로 이동하지 않았습니다/)).toBeNull();
  });

  it("uses default preferences when persisted preference JSON is invalid", async () => {
    const nextRoom = { ...makeLayout(), id: "room-4", name: "Next Room" };
    roomApiMocks.getSampleRooms.mockResolvedValueOnce([makeRoomCard(4, nextRoom)]);
    localStorage.setItem("roomfit:preferencesByRoomId", "not-json");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => render(<Rooms />)).not.toThrow();
    const nextRoomButton = await screen.findByRole("button", { name: /Next Room/ });
    await userEvent.click(nextRoomButton);
    await waitFor(() => expect(nextRoomButton.getAttribute("aria-pressed")).toBe("true"));

    expect(readSelectedRoomEnvelope()).toMatchObject({
      status: "valid",
      selection: { backendRoomId: 4, uiRoomLayoutId: nextRoom.id },
    });
    expect(localStorage.getItem("roomfit:selectedAdditionalFurnitureIds")).toBe("[]");
  });

  it("renders Rooms with fallback thumbnails when thumbnail storage throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const originalGetItem = localStorage.getItem.bind(localStorage);
    vi.spyOn(localStorage, "getItem").mockImplementation((key: string) => {
      if (key === "roomfit:roomThumbnailsByLayoutId") {
        throw new Error("thumbnail storage unavailable");
      }
      return originalGetItem(key);
    });

    expect(() => render(<Rooms />)).not.toThrow();
    expect(await screen.findByRole("button", { name: new RegExp(TEST_ROOM.name) })).not.toBeNull();
  });

  it("renders LayoutConfirm with a safe scenario fallback when scenario storage throws", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const originalGetItem = localStorage.getItem.bind(localStorage);
    vi.spyOn(localStorage, "getItem").mockImplementation((key: string) => {
      if (key === "roomfit:selectedPurpose" || key === "roomfit:selectedStyle") {
        throw new Error("scenario storage unavailable");
      }
      return originalGetItem(key);
    });

    expect(() => renderConfirm()).not.toThrow();
    expect(screen.getByText(TEST_ROOM.name)).not.toBeNull();
  });

  it("restores React selection from the authoritative Room after preference fallback", async () => {
    const nextRoom = { ...makeLayout(), id: "room-4", name: "Next Room" };
    roomApiMocks.getSampleRooms.mockResolvedValue([makeRoomCard(4, nextRoom)]);
    localStorage.setItem("roomfit:preferencesByRoomId", "not-json");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const firstView = render(<Rooms />);
    const nextRoomButton = await screen.findByRole("button", { name: /Next Room/ });
    await userEvent.click(nextRoomButton);
    await waitFor(() => expect(nextRoomButton.getAttribute("aria-pressed")).toBe("true"));

    firstView.unmount();
    render(<Rooms />);
    const restoredButton = await screen.findByRole("button", { name: /Next Room/ });
    expect(restoredButton.getAttribute("aria-pressed")).toBe("true");
    expect(readSelectedRoomEnvelope()).toMatchObject({
      status: "valid",
      selection: { backendRoomId: 4, uiRoomLayoutId: nextRoom.id },
    });
  });

  it("renders ManageFurniture safely without API or UI edits when storage getters throw", async () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => render(<ManageFurniture />)).not.toThrow();
    await screen.findByRole("alert");
    const initialPosition = screen.getByTestId("first-furniture-x").textContent;
    fireEvent.click(screen.getByRole("button", { name: "move-first" }));
    expect(roomApiMocks.updateRoomFurniture).not.toHaveBeenCalled();
    expect(screen.getByTestId("first-furniture-x").textContent).toBe(initialPosition);
  });

  it("does not change the Room coordinator owner when workflow acquisition fails", async () => {
    const otherOwner = { ownerBackendRoomId: 4, ownerUiRoomLayoutId: "room-4" };
    setActiveRoomFurnitureSaveSession(otherOwner);
    workflowToken = beginActiveLayoutWorkflow("feedback", null);

    render(<ManageFurniture />);
    await screen.findByRole("alert");
    expect(getActiveRoomFurnitureSaveState().session).toEqual(otherOwner);
    expect(getActiveRoomFurnitureSaveState().latestRevision).toBe(0);
    expect(roomApiMocks.updateRoomFurniture).not.toHaveBeenCalled();
  });

  it("keeps pending reconciliation evidence when the confirmed marker write fails", async () => {
    writeLayoutSession(TEST_SESSION);
    setActiveLayoutSession(TEST_SESSION);
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const readStoredValue = localStorage.getItem.bind(localStorage);
    let confirmMarkerWrites = 0;
    vi.spyOn(localStorage, "setItem").mockImplementation((key: string, value: string) => {
      if (key === "roomfit:layoutConfirmAttempt:v1") {
        confirmMarkerWrites += 1;
        if (confirmMarkerWrites === 2) {
          throw new Error("quota");
        }
      }
      return originalSetItem(key, value);
    });

    renderConfirm();
    await userEvent.click(screen.getByRole("button", { name: "확정하기" }));
    await screen.findByText("최종 배치가 확정되었습니다");
    expect(screen.getByRole("status").textContent).toContain("복구 기록 저장에 실패");
    expect(JSON.parse(readStoredValue("roomfit:layoutConfirmAttempt:v1") ?? "null").status).toBe("pending");
    expect(isLayoutSessionConfirmPending(TEST_SESSION)).toBe(true);
    expect(readLayoutSession()).toEqual(TEST_SESSION);
    expect(getActiveLayoutSaveState().session).toEqual(TEST_SESSION);
  });

  it("renders the Editor when legacy session migration cannot write storage", () => {
    localStorage.setItem("roomfit:backendLayoutId", String(TEST_SESSION.layoutId));
    localStorage.setItem("roomfit:backendLayoutRoomId", TEST_ROOM.id);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => render(<EditorPlaceholder />)).not.toThrow();
    expect(screen.getByText(TEST_ROOM.name)).not.toBeNull();
  });

  it("renders a safe Editor fallback when stale session removal throws", () => {
    localStorage.setItem("roomfit:layoutSession:v1", JSON.stringify({
      ...TEST_SESSION,
      ownerUiRoomLayoutId: "another-room",
    }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => render(<EditorPlaceholder />)).not.toThrow();
    expect(screen.getByText(TEST_ROOM.name)).not.toBeNull();
  });
});

function seedSelectedRoom(): void {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("roomfit:backendRoomId", String(TEST_SESSION.ownerBackendRoomId));
  localStorage.setItem("roomfit:selectedRoomId", TEST_ROOM.id);
  localStorage.setItem("roomfit:selectedRoomTitle", TEST_ROOM.name);
  localStorage.setItem("roomfit:selectedRoomType", "원룸");
  localStorage.setItem("roomfit:selectedRoomSize", "20㎡");
  localStorage.setItem("roomfit:selectedRoomLayout", JSON.stringify(TEST_ROOM));
}

function makeRoomCard(roomId: number, room: RoomLayout) {
  return {
    ...TEST_ROOM_CARD,
    roomId,
    title: room.name,
    layoutId: room.id,
    layout: room,
  };
}

async function waitUntilManageIsReady(): Promise<void> {
  await waitFor(() => {
    expect(screen.queryByText("이전 배치를 저장하는 중입니다.")).toBeNull();
  });
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderConfirm() {
  return render(
    <MemoryRouter initialEntries={["/layout-confirm"]}>
      <LayoutConfirm />
    </MemoryRouter>,
  );
}

function installTestStorage(): void {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
