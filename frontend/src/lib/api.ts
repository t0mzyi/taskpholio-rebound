import axios from "axios";
import { supabase } from "@/lib/supabase";

// Relative URL — Next.js rewrites proxy this to http://localhost:5000/api/v1/
const API_BASE_URL = "/api/v1/";

/**
 * Always returns the freshest available token:
 * 1. Tries Supabase's live session (auto-refreshed by Supabase SDK).
 * 2. Falls back to taskpholio_token in localStorage/sessionStorage.
 *
 * This prevents the "Strategic route not found" / 401 errors that occur on
 * repeated hard refreshes when Supabase has rotated the access token but the
 * stored taskpholio_token is still pointing at the old one.
 */
const getFreshToken = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      // Keep taskpholio_token in sync so other code reading it stays current
      const storage = localStorage.getItem("taskpholio_token")
        ? localStorage
        : sessionStorage;
      storage.setItem("taskpholio_token", data.session.access_token);
      return data.session.access_token;
    }
  } catch {
    // Supabase unavailable — fall through to stored token
  }
  return (
    localStorage.getItem("taskpholio_token") ||
    sessionStorage.getItem("taskpholio_token")
  );
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: 45000,
});

// REQUEST INTERCEPTOR — attaches fresh auth token on every call
api.interceptors.request.use(async (config) => {
  // Fix: If URL starts with a slash, Axios overrides baseURL. Strip it so
  // the /api/v1 prefix from baseURL is preserved correctly.
  if (config.url && config.url.startsWith("/")) {
    config.url = config.url.substring(1);
  }

  const fullUrl = `${config.baseURL}${config.url}`;
  console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${fullUrl}`, config.data);

  const token = await getFreshToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// RESPONSE INTERCEPTOR — logs results and handles global 401 redirects
api.interceptors.response.use(
  (response) => {
    console.log(
      `[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}:`,
      response.data
    );
    return response;
  },
  (error) => {
    console.error(
      `[API ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`,
      error.response?.data || error.message
    );
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("taskpholio_token");
        sessionStorage.removeItem("taskpholio_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
