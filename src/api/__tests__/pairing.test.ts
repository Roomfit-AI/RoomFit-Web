import { describe, expect, it, vi } from "vitest";

import { redeemPairingCode } from "../pairing";
import { apiClient } from "../client";

const CLIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function axiosErrorLike(status: number | undefined, code?: string) {
  return Object.assign(new Error("request failed"), {
    isAxiosError: true,
    response: status === undefined ? undefined : { status, data: { error: code ? { code } : null } },
  });
}

describe("redeemPairingCode", () => {
  it("posts the code with the PUBLIC scope and returns the resolved clientId", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { success: true, data: { clientId: CLIENT_ID }, error: null },
    });

    try {
      await expect(redeemPairingCode("K7X9QP42")).resolves.toBe(CLIENT_ID);
      expect(post).toHaveBeenCalledWith(
        "/api/clients/pairing-code/redeem",
        { code: "K7X9QP42" },
        { roomfitClientScope: "PUBLIC" },
      );
    } finally {
      post.mockRestore();
    }
  });

  it("surfaces a friendly message for an unknown/expired code", async () => {
    const post = vi.spyOn(apiClient, "post").mockRejectedValue(axiosErrorLike(404, "PAIRING_CODE_NOT_FOUND"));

    try {
      await expect(redeemPairingCode("ZZZZZZZZ")).rejects.toThrow("코드를 찾을 수 없습니다");
    } finally {
      post.mockRestore();
    }
  });

  it("surfaces a network message when the request never reached the server", async () => {
    const post = vi.spyOn(apiClient, "post").mockRejectedValue(axiosErrorLike(undefined));

    try {
      await expect(redeemPairingCode("K7X9QP42")).rejects.toThrow("서버에 연결하지 못했습니다");
    } finally {
      post.mockRestore();
    }
  });
});
