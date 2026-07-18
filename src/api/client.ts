import axios from "axios";
import { CLIENT_ID_HEADER, getActiveRequestClientId, normalizeClientId } from "../config/clientScope";

export type RoomFitClientScope = "SCOPED" | "PUBLIC" | "EXPLICIT";

declare module "axios" {
  interface AxiosRequestConfig {
    roomfitClientScope?: RoomFitClientScope;
    roomfitClientIdOverride?: string;
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "https://roomfit-backend.onrender.com";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  if (config.roomfitClientScope === "PUBLIC") {
    config.headers.delete(CLIENT_ID_HEADER);
    return config;
  }

  if (config.roomfitClientScope === "EXPLICIT") {
    const clientId = normalizeClientId(config.roomfitClientIdOverride);
    if (!clientId) {
      throw new Error("명시적 Client Scope에 유효한 clientId가 필요합니다.");
    }
    config.headers.set(CLIENT_ID_HEADER, clientId);
    return config;
  }

  const clientId = getActiveRequestClientId();
  if (clientId) {
    config.headers.set(CLIENT_ID_HEADER, clientId);
  } else {
    config.headers.delete(CLIENT_ID_HEADER);
  }
  return config;
});
