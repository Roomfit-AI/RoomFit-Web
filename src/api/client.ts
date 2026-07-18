import axios from "axios";
import { CLIENT_ID_HEADER, getActiveRequestClientId } from "../config/clientScope";

export type RoomFitClientScope = "SCOPED" | "PUBLIC";

declare module "axios" {
  interface AxiosRequestConfig {
    roomfitClientScope?: RoomFitClientScope;
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

  const clientId = getActiveRequestClientId();
  if (clientId) {
    config.headers.set(CLIENT_ID_HEADER, clientId);
  } else {
    config.headers.delete(CLIENT_ID_HEADER);
  }
  return config;
});
