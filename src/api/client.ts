import axios from "axios";

export const apiClient = axios.create({
  baseURL: "https://roomfit-backend.onrender.com",
  timeout: 30000,
});
