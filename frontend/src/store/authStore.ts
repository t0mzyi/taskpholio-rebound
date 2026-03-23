"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/lib/types";
import api from "@/lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string, team?: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  setAuth: (user: User, token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const API = process.env.NEXT_PUBLIC_API_URL;
          console.log("LOGIN ATTEMPT TO:", `${api.defaults.baseURL}auth/login`);
          
          const res = await api.post("auth/login", { email, password });
          const token = res.data.data.token;
          const user = res.data.data.user;
          
          localStorage.setItem("taskpholio_token", token);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ isLoading: false });
          console.error("LOGIN ERROR:", err.response?.data || err.message);
          throw err;
        }
      },

      register: async (name, email, password, role, team) => {
        set({ isLoading: true });
        try {
          const API = process.env.NEXT_PUBLIC_API_URL;
          console.log("REGISTER URL:", `${API}/auth/register`);
          
          const payload = team ? { name, email, password, role, team } : { name, email, password, role };
          const res = await api.post("auth/register", payload);
          const token = res.data.data.token;
          const user = res.data.data.user;
          
          localStorage.setItem("taskpholio_token", token);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ isLoading: false });
          console.error("REGISTER ERROR:", err.response?.data || err.message);
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem("taskpholio_token");
        set({ user: null, token: null, isAuthenticated: false });
      },

      fetchMe: async () => {
        try {
          const res = await api.get("auth/me");
          set({ user: res.data.data.user, isAuthenticated: true });
        } catch {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
    }),
    {
      name: "taskpholio-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
