"use client";
import { create } from "zustand";
import { User, Team } from "@/lib/types";
import api from "@/lib/api";

interface AdminState {
  users: User[];
  teams: Team[];
  isLoading: boolean;
  fetchUsers: (filters?: Record<string, string>) => Promise<void>;
  fetchTeams: () => Promise<void>;
  createUser: (data: { name: string; email: string; password: string; role: string; team?: string }) => Promise<User>;
  updateUser: (id: string, data: Partial<User> & { team?: string | null }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  createTeam: (data: { name: string; description?: string; managerId: string; memberIds?: string[] }) => Promise<Team>;
  updateTeam: (id: string, data: any) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addMembers: (teamId: string, memberIds: string[]) => Promise<void>;
  removeMembers: (teamId: string, memberIds: string[]) => Promise<void>;
}

export const useAdminStore = create<AdminState>()((set, get) => ({
  users: [],
  teams: [],
  isLoading: false,

  fetchUsers: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams(filters).toString();
      const res = await api.get(`/auth/users${params ? `?${params}` : ""}`);
      const users = res.data.data.users;
      set({ users, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  fetchTeams: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get("/teams");
      const teams = res.data.data.teams;
      set({ teams, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  createUser: async (data) => {
    const res = await api.post("/auth/register", data);
    const user = res.data.data.user;
    set((s) => ({ users: [user, ...s.users] }));
    return user;
  },

  updateUser: async (id, data) => {
    const res = await api.patch(`/auth/users/${id}`, data);
    const updated = res.data.data.user;
    set((s) => ({ users: s.users.map((u) => (u._id === id ? updated : u)) }));
  },

  deleteUser: async (id) => {
    await api.delete(`/auth/users/${id}`);
    set((s) => ({ users: s.users.filter((u) => u._id !== id) }));
  },

  createTeam: async (data) => {
    const res = await api.post("/teams", data);
    const team = res.data.data.team;
    set((s) => ({ teams: [team, ...s.teams] }));
    return team;
  },

  updateTeam: async (id, data) => {
    const res = await api.patch(`/teams/${id}`, data);
    const updated = res.data.data.team;
    set((s) => ({ teams: s.teams.map((t) => (t._id === id ? updated : t)) }));
  },

  deleteTeam: async (id) => {
    await api.delete(`/teams/${id}`);
    set((s) => ({ teams: s.teams.filter((t) => t._id !== id) }));
  },

  addMembers: async (teamId, memberIds) => {
    const res = await api.post(`/teams/${teamId}/members`, { memberIds });
    const updated = res.data.data.team;
    set((s) => ({ teams: s.teams.map((t) => (t._id === teamId ? updated : t)) }));
  },

  removeMembers: async (teamId, memberIds) => {
    await api.delete(`/teams/${teamId}/members`, { data: { memberIds } });
    get().fetchTeams();
  },
}));
