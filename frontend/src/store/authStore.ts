"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/lib/types";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getDisplayName, normalizeUserRole } from "@/lib/utils";
import { registerPushSubscription } from "@/lib/pushSubscription";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  staySignedIn: boolean;
  login: (email: string, password: string, staySignedIn?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string, role: string, team?: string, staySignedIn?: boolean) => Promise<boolean>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  setAuth: (user: User, token: string) => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  setStaySignedIn: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      staySignedIn: true,

      login: async (email, password, staySignedIn = true) => {
        set({ isLoading: true, staySignedIn });
        console.log(`[AUTH] Attempting login for: ${email}`);
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          
          if (error) {
            console.error("[AUTH] Supabase Auth Error:", error.message);
            throw error;
          }

          const { session, user: authUser } = data;
          console.log(`[AUTH] Auth success, user ID: ${authUser.id}`);
          
          // Fetch the profile from the profiles table
          let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (profileError) {
            const noProfileFound =
              profileError.code === "PGRST116" ||
              profileError.message?.toLowerCase().includes("0 rows");

            if (noProfileFound) {
              const roleMeta = (authUser.user_metadata?.role || "member").toString().toLowerCase();
              const normalizedRole = ["ceo", "cto", "member"].includes(roleMeta) ? roleMeta : "member";

              const { data: repairedProfile, error: repairError } = await supabase
                .from("profiles")
                .upsert({
                  id: authUser.id,
                  full_name: getDisplayName(authUser.user_metadata?.full_name, authUser.email),
                  email: authUser.email,
                  role: normalizedRole,
                  team: null,
                  is_active: true,
                })
                .select("*")
                .single();

              if (repairError) {
                console.error("[AUTH] Profile repair failed:", repairError.message);
                throw repairError;
              }

              profile = repairedProfile;
            } else {
              console.error("[AUTH] Profile fetch error:", profileError.message);
              throw profileError;
            }
          }

          console.log("[AUTH] Profile fetched successfully:", profile.role);

          const user: User = {
            _id: profile.id,
            name: getDisplayName(profile.full_name, profile.email),
            email: profile.email,
            role: normalizeUserRole(profile.role),
            status: "active",
            lastActive: new Date().toISOString(),
            team: profile.team,
            avatar: profile.avatar_url
          };
          
          const storage = staySignedIn ? localStorage : sessionStorage;
          storage.setItem("taskpholio_token", session.access_token);
          
          set({ user, token: session.access_token, isAuthenticated: true, isLoading: false });
          console.log("[AUTH] Login state updated for user:", user.name);

          if (typeof window !== "undefined" && "Notification" in window) {
            const ensurePush = async () => {
              const permission =
                window.Notification.permission === "granted"
                  ? "granted"
                  : await window.Notification.requestPermission();
              if (permission === "granted") {
                await registerPushSubscription();
              }
            };
            ensurePush().catch((pushError) => {
              console.error("[AUTH] Push setup after login failed:", pushError);
            });
          }
        } catch (err: any) {
          console.error("[AUTH] Login failed:", err.message);
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (name, email, password, role, team, staySignedIn = true) => {
        set({ isLoading: true, staySignedIn });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name,
                role: role.toLowerCase() // "cto", "ceo", "member"
              }
            }
          });

          if (error) throw error;
          
          if (!data.session) {
            toast.info("Registration successful. Please check your email for confirmation.");
            set({ isLoading: false });
            return false;
          }

          // If auto-login is enabled by Supabase
          const { session, user: authUser } = data;
          
          const userObj: User = {
            _id: authUser.id,
            name: getDisplayName(name, email),
            email: email,
            role: normalizeUserRole(role),
            status: "active",
            lastActive: new Date().toISOString(),
            team: team,
            avatar: null
          };
          
          const storage = staySignedIn ? localStorage : sessionStorage;
          storage.setItem("taskpholio_token", session.access_token);
          
          set({ user: userObj, token: session.access_token, isAuthenticated: true, isLoading: false });
          return true;
        } catch (err: any) {
          set({ isLoading: false });
          const message = (err?.message || "").toLowerCase();
          if (message.includes("already registered") || message.includes("user already registered")) {
            throw new Error("This email is already registered. Please sign in instead.");
          }
          if (message.includes("email not confirmed")) {
            throw new Error("Please confirm your email before signing in.");
          }
          throw err;
        }
      },

      fetchMe: async () => {
        try {
          const { data: { user: authUser }, error } = await supabase.auth.getUser();
          if (error || !authUser) throw error || new Error("No user");

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (profileError) throw profileError;

          const user: User = {
            _id: profile.id,
            name: getDisplayName(profile.full_name, profile.email),
            email: profile.email,
            role: normalizeUserRole(profile.role),
            status: "active",
            lastActive: new Date().toISOString(),
            team: profile.team,
            avatar: profile.avatar_url
          };

          set({ user, isAuthenticated: true });

          if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
            registerPushSubscription().catch((pushError) => {
              console.error("[AUTH] Push refresh during session restore failed:", pushError);
            });
          }
        } catch (error) {
          set({ user: null, token: null, isAuthenticated: false });
          localStorage.removeItem("taskpholio_token");
          sessionStorage.removeItem("taskpholio_token");
        }
      },

      setAuth: (user, token) => {
        set({ user, token, isAuthenticated: true });
      },

      logout: async () => {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error("LOGOUT ERROR:", err);
        } finally {
          localStorage.removeItem("taskpholio_token");
          sessionStorage.removeItem("taskpholio_token");
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      updateProfile: async (updates) => {
        try {
          const res = await api.patch("auth/profile", updates);
          set({ user: res.data.data.user });
        } catch (err) {
          console.error("Profile update failed:", err);
          throw err;
        }
      },

      setStaySignedIn: (value) => set({ staySignedIn: value })
    }),
    {
      name: "taskpholio-auth",
      storage: {
        getItem: (name) => {
          const local = localStorage.getItem(name);
          if (local) return JSON.parse(local);
          const session = sessionStorage.getItem(name);
          if (session) return JSON.parse(session);
          return null;
        },
        setItem: (name, value) => {
          const valStr = JSON.stringify(value);
          if (value.state.staySignedIn) {
            localStorage.setItem(name, valStr);
            sessionStorage.removeItem(name);
          } else {
            sessionStorage.setItem(name, valStr);
            localStorage.removeItem(name);
          }
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
          sessionStorage.removeItem(name);
        },
      },
      partialize: (state) => ({ token: state.token, user: state.user, staySignedIn: state.staySignedIn } as any),
    }
  )
);
