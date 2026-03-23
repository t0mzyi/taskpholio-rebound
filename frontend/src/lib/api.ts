import axios from "axios";
let RAW_URL = process.env.NEXT_PUBLIC_API_URL || "https://taskpholio-saas-1.onrender.com/api/v1";

// Ensure /api/v1 prefix is present (Defensive check for Vercel env mismatches)
if (RAW_URL && !RAW_URL.includes("/api/v1")) {
  RAW_URL = RAW_URL.endsWith("/") ? `${RAW_URL}api/v1` : `${RAW_URL}/api/v1`;
}

const API_BASE_URL = RAW_URL.endsWith('/') ? RAW_URL : `${RAW_URL}/`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// DIAGNOSTIC REQUEST LOGGING
api.interceptors.request.use((config) => {
  const fullUrl = `${config.baseURL}${config.url}`;
  console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${fullUrl}`, config.data);
  
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("taskpholio_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// DIAGNOSTIC RESPONSE/ERROR LOGGING
api.interceptors.response.use(
  (response) => {
    console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}:`, response.data);
    return response;
  },
  (error) => {
    console.error(`[API ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, error.response?.data || error.message);
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("taskpholio_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
