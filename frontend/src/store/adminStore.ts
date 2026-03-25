"use client";
import { create } from "zustand";
import { User, Team } from "@/lib/types";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";

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
      const { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const { data: teamsList } = await supabase.from('teams').select('id, name');
      const teamMap = new Map(teamsList?.map(t => [t.id, t]) || []);

      const users = profiles.map(p => ({
        _id: p.id,
        name: p.full_name,
        email: p.email,
        role: p.role === 'ceo' ? 'CEO' : p.role === 'cto' ? 'CTO' : 'Member',
        status: p.is_active ? 'active' : 'inactive',
        createdAt: p.created_at,
        avatar: p.avatar_url,
        team: p.team ? teamMap.get(p.team) : null
      }));

      set({ users: users as any, isLoading: false });
    } catch { 
      set({ isLoading: false }); 
    }
  },

  fetchTeams: async () => {
    set({ isLoading: true });
    try {
      const { data: dbTeams, error: teamError } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
      if (teamError) throw teamError;

      const teams = await Promise.all(
        (dbTeams || []).map(async (t) => {
          const { data: members } = await supabase
            .from('profiles')
            .select('id, full_name, email, role, avatar_url')
            .eq('team', t.id);

          const leadMember = members?.find(m => m.role.toLowerCase() === 'cto' || m.role.toLowerCase() === 'ceo') || members?.[0];

          const mappedManager = leadMember ? {
             _id: leadMember.id,
             name: leadMember.full_name,
             email: leadMember.email,
             role: leadMember.role,
             avatar: leadMember.avatar_url,
          } : null;

          return {
            _id: t.id,
            id: t.id,
            name: t.name,
            description: t.description || `The ${t.name} squad.`,
            manager: mappedManager,
            lead: mappedManager,
            members: (members || []).map(m => ({
              _id: m.id,
              name: m.full_name,
              email: m.email,
              role: m.role,
              avatar: m.avatar_url,
            })),
            stats: { totalTasks: 0, completedTasks: 0, activeTasks: 0 },
            color: '#3b82f6', // Default UI color Since table doesn't have it
          };
        })
      );
      set({ teams: teams as any, isLoading: false });
    } catch (e) {
      console.error('fetchTeams error:', e);
      set({ isLoading: false });
    }
  },

  createUser: async (data) => {
    const getFreshAccessToken = async (): Promise<string | null> => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) return null;

      const expiresSoon =
        typeof session.expires_at === "number" &&
        session.expires_at * 1000 <= Date.now() + 30_000;

      if (!expiresSoon) return session.access_token;

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed?.session?.access_token) {
        return refreshed.session.access_token;
      }

      return session.access_token;
    };

    const isAuthFailure = (message: string, status?: number): boolean => {
      const normalized = (message || "").toLowerCase();
      return (
        status === 401 ||
        normalized.includes("invalid token") ||
        normalized.includes("authentication failed") ||
        normalized.includes("jwt expired") ||
        normalized.includes("missing authorization")
      );
    };

    let accessToken = await getFreshAccessToken();
    if (!accessToken) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const invokeCreateMember = async (accessToken: string) =>
      supabase.functions.invoke('create-member', {
        body: {
          full_name: data.name,
          email: data.email,
          password: data.password,
          role: data.role.toLowerCase(),
          team: data.team
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

    const parseEdgeError = async (err: any): Promise<{ message: string; status?: number }> => {
      let message = (err?.message || "Failed to create member").toString();
      const response = err?.context;
      if (!response) return { message };

      const status = typeof response?.status === "number" ? response.status : undefined;

      try {
        const json = await response.clone().json();
        message = (json?.error || json?.message || message).toString();
        return { message, status };
      } catch {
        try {
          const text = await response.clone().text();
          if (text) {
            try {
              const parsed = JSON.parse(text);
              message = (parsed?.error || parsed?.message || text).toString();
            } catch {
              message = text.toString();
            }
          }
        } catch {
          // Keep fallback message if body cannot be read
        }
      }

      return { message, status };
    };

    let { data: result, error } = await invokeCreateMember(accessToken);

    if (error) {
      let parsed = await parseEdgeError(error);

      if (isAuthFailure(parsed.message, parsed.status)) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session?.access_token) {
          accessToken = refreshed.session.access_token;
          const retry = await invokeCreateMember(accessToken);
          result = retry.data;
          error = retry.error;
          if (error) {
            parsed = await parseEdgeError(error);
          }
        }
      }

      if (error) {
        console.error("EDGE FUNCTION ERROR:", {
          status: parsed.status,
          message: parsed.message,
          raw: error,
        });

        const normalized = parsed.message.toLowerCase();
        if (parsed.status === 401 || normalized.includes("invalid token") || normalized.includes("authentication failed")) {
          throw new Error("Your session has expired. Please sign in again.");
        }
        if (parsed.status === 404 || (normalized.includes("function") && normalized.includes("not found"))) {
          throw new Error("The create-member function is not deployed.");
        }
        if (normalized.includes("failed to send a request to the edge function") || normalized.includes("networkerror")) {
          throw new Error("Cannot reach user creation service. Please check your internet and deploy status.");
        }
        if (parsed.status && parsed.status >= 500) {
          throw new Error(`Create-member service failed (${parsed.status}). ${parsed.message}`);
        }
        throw new Error(parsed.message || "Failed to create member");
      }
    }

    if (!error && (result?.success === false || result?.error)) {
      const firstMessage = (result?.error || "Creation failed").toString();
      if (isAuthFailure(firstMessage)) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session?.access_token) {
          accessToken = refreshed.session.access_token;
          const retry = await invokeCreateMember(accessToken);
          result = retry.data;
          error = retry.error;
        }
      }
    }

    if (error) {
      const parsed = await parseEdgeError(error);
      const normalized = parsed.message.toLowerCase();
      if (isAuthFailure(parsed.message, parsed.status)) {
        throw new Error("Your session has expired. Please sign in again.");
      }
      if (parsed.status === 404 || (normalized.includes("function") && normalized.includes("not found"))) {
        throw new Error("The create-member function is not deployed.");
      }
      if (normalized.includes("failed to send a request to the edge function") || normalized.includes("networkerror")) {
        throw new Error("Cannot reach user creation service. Please check your internet and deploy status.");
      }
      if (parsed.status && parsed.status >= 500) {
        throw new Error(`Create-member service failed (${parsed.status}). ${parsed.message}`);
      }
      throw new Error(parsed.message || "Failed to create member");
    }

    if (result?.success === false || result?.error) {
      const message = (result?.error || "Creation failed").toString();
      const normalized = message.toLowerCase();
      if (isAuthFailure(message)) {
        throw new Error("Your session has expired. Please sign in again.");
      }
      if (normalized.includes("forbidden")) {
        throw new Error("Only CEO/CTO accounts can add new users.");
      }
      throw new Error(message);
    }

    if (!result?.userId) {
      throw new Error("User creation did not return a user id.");
    }

    const newUser: User = {
      _id: result.userId,
      name: data.name,
      email: data.email,
      role: data.role as any,
      status: "active",
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      team: data.team
    };

    get().fetchUsers();
    get().fetchTeams();
    return newUser;
  },

  updateUser: async (id, data) => {
    // Update local immediately if needed
    // Assuming backend edge functions for full user update
  },

  deleteUser: async (id) => {
    // Edge function needed
  },

  createTeam: async (data) => {
    const { data: newTeam, error } = await supabase.from('teams').insert({
      name: data.name,
      description: data.description
    }).select().single();
    if (error) throw error;
    
    const teamObj = {
      _id: newTeam.id,
      id: newTeam.id,
      name: newTeam.name,
      description: newTeam.description,
      members: [],
      lead: null,
      manager: null,
      stats: { totalTasks: 0, completedTasks: 0, activeTasks: 0 },
      color: '#3b82f6'
    };
    
    set((s) => ({ teams: [teamObj as any, ...s.teams] }));
    return teamObj as any;
  },

  updateTeam: async (id, data) => {
    const { data: updated, error } = await supabase.from('teams').update({
      name: data.name,
      description: data.description
    }).eq('id', id).select().single();
    if (error) throw error;

    set((s) => ({ teams: s.teams.map((t) => (t._id === id ? { ...t, name: updated.name, description: updated.description } : t)) }));
  },

  deleteTeam: async (id) => {
    await supabase.from('teams').delete().eq('id', id);
    set((s) => ({ teams: s.teams.filter((t) => t._id !== id) }));
  },

  addMembers: async (teamId, memberIds) => {
    await Promise.all(memberIds.map(uid => 
      supabase.from('profiles').update({ team: teamId }).eq('id', uid)
    ));
    get().fetchTeams();
  },

  removeMembers: async (teamId, memberIds) => {
    await Promise.all(memberIds.map(uid => 
      supabase.from('profiles').update({ team: null }).eq('id', uid)
    ));
    get().fetchTeams();
  },
}));
