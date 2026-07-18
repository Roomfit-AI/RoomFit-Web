import { isAxiosError } from "axios";

import { apiClient } from "./client";
import { normalizeClientId } from "../config/clientScope";
import { normalizePairingCode, PAIRING_CODE_FORMAT_ERROR } from "../config/pairingCode";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string } | null;
}

interface PairingCodeRedeemResponse {
  clientId: string;
}

export async function redeemPairingCode(code: string): Promise<string> {
  const normalizedCode = normalizePairingCode(code);
  if (!normalizedCode) throw new Error(PAIRING_CODE_FORMAT_ERROR);

  try {
    const response = await apiClient.post<ApiResponse<PairingCodeRedeemResponse>>(
      "/api/clients/pairing-code/redeem",
      { code: normalizedCode },
      { roomfitClientScope: "PUBLIC" },
    );
    const clientId = normalizeClientId(response.data.data?.clientId);
    if (!response.data.success || !clientId) {
      throw new InvalidPairingResponseError();
    }
    return clientId;
  } catch (error) {
    throw new Error(toPairingErrorMessage(error), { cause: error });
  }
}

export function toPairingErrorMessage(error: unknown): string {
  if (error instanceof InvalidPairingResponseError) {
    return "RoomFit Scan의 연결 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (isAxiosError<{ error?: { code?: string } }>(error)) {
    const code = error.response?.data.error?.code;
    if (error.response?.status === 400
      || error.response?.status === 404
      || code === "PAIRING_CODE_NOT_FOUND"
      || code === "INVALID_PAIRING_CODE") {
      return "연결 코드를 확인해주세요. 앱에 표시된 코드를 다시 입력해주세요.";
    }
    if (!error.response) {
      return "RoomFit Scan과 연결하지 못했습니다. 잠시 후 다시 시도해주세요.";
    }
  }
  return "RoomFit Scan과 연결하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

class InvalidPairingResponseError extends Error {}
