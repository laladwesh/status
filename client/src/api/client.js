import axios from "axios";
import { clearAuthSession, getToken } from "../utils/auth";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "/api",
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthSession();
    }

    return Promise.reject(error);
  }
);

export default apiClient;
