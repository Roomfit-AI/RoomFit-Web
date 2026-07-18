import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";

import { apiClient } from "../client";
import { redeemPairingCode } from "../clientPairing";

const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("pairing code redeem API", () => {
  it("normalizes the body and uses a headerless PUBLIC request", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { success: true, data: { clientId: APP_ID }, error: null },
    });
    try {
      await expect(redeemPairingCode("k7x9qp42")).resolves.toBe(APP_ID);
      expect(post).toHaveBeenCalledWith(
        "/api/clients/pairing-code/redeem",
        { code: "K7X9-QP42" },
        { roomfitClientScope: "PUBLIC" },
      );
    } finally {
      post.mockRestore();
    }
  });

  it("does not issue HTTP for malformed input", async () => {
    const post = vi.spyOn(apiClient, "post");
    try {
      await expect(redeemPairingCode("bad")).rejects.toThrow("8자리");
      expect(post).not.toHaveBeenCalled();
    } finally {
      post.mockRestore();
    }
  });

  it("rejects an invalid clientId response", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { success: true, data: { clientId: "invalid" }, error: null },
    });
    try {
      await expect(redeemPairingCode("K7X9-QP42")).rejects.toThrow("응답을 확인");
    } finally {
      post.mockRestore();
    }
  });

  it.each([
    ["a raw UUID string", APP_ID],
    ["a UUID string in ApiResponse.data", { success: true, data: APP_ID, error: null }],
    ["a differently named object field", { success: true, data: { id: APP_ID }, error: null }],
  ])("rejects %s because the backend contract is data.clientId", async (_label, data) => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data });
    try {
      await expect(redeemPairingCode("K7X9-QP42")).rejects.toThrow("응답을 확인");
    } finally {
      post.mockRestore();
    }
  });

  it("maps invalid-code and network failures to safe messages", async () => {
    const post = vi.spyOn(apiClient, "post")
      .mockRejectedValueOnce(new AxiosError("bad", "ERR_BAD_REQUEST", undefined, undefined, { status: 404, data: {} } as never))
      .mockRejectedValueOnce(new AxiosError("offline", "ERR_NETWORK"));
    try {
      await expect(redeemPairingCode("K7X9-QP42")).rejects.toThrow("연결 코드를 확인");
      await expect(redeemPairingCode("K7X9-QP42")).rejects.toThrow("잠시 후");
    } finally {
      post.mockRestore();
    }
  });
});
