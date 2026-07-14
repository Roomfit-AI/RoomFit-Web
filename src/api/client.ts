import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "https://roomfit-backend.onrender.com";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});
