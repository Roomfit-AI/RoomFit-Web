import { isAxiosError } from "axios";

import { apiClient } from "./client";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  } | null;
}

interface PairingCodeRedeemApiItem {
  clientId: string;
}

/**
 * 앱에서 발급받은 영구 페어링 코드로 그 앱의 clientId를 알아낸다. 아직 이
 * 브라우저의 신원을 모르는 상태에서 부르는 호출이라 clientScope 헤더를
 * 일부러 붙이지 않는다(roomfitClientScope: "PUBLIC") — 붙여봐야 백엔드가
 * 무시하긴 하지만, 호출 의도를 코드로도 분명히 남겨둔다.
 */
export async function redeemPairingCode(code: string): Promise<string> {
  try {
    const response = await apiClient.post<ApiResponse<PairingCodeRedeemApiItem>>(
      "/api/clients/pairing-code/redeem",
      { code },
      { roomfitClientScope: "PUBLIC" },
    );
    return response.data.data.clientId;
  } catch (error) {
    throw new Error(toPairingCodeErrorMessage(error), { cause: error });
  }
}

function toPairingCodeErrorMessage(error: unknown): string {
  if (isAxiosError<{ error?: { code?: string; message?: string } }>(error)) {
    if (error.response?.status === 404 || error.response?.data?.error?.code === "PAIRING_CODE_NOT_FOUND") {
      return "코드를 찾을 수 없습니다. 앱에 표시된 코드를 다시 확인해 주세요.";
    }
    if (!error.response) {
      return "서버에 연결하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
    }
  }
  return "코드를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
