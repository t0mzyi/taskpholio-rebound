import axios from "axios";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.endsWith('/') 
  ? process.env.NEXT_PUBLIC_API_URL 
  : `${process.env.NEXT_PUBLIC_API_URL}/`;

if (!API_BASE_URL) {
  console.warn("NEXT_PUBLIC_API_URL is not defined. API requests might fail.");
}

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
