"use client";
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

interface Notification {
  _id: string;
  user: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  addNotification: (notification: Notification) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  initRealtime: (userId: string) => void;
}

let notificationRealtimeChannel: RealtimeChannel | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.read ? state.unreadCount : state.unreadCount + 1
    }));
  },

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        set({ loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', sessionData.session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(n => ({
        _id: n.id,
        user: n.user_id,
        type: n.type,
        title: n.title,
        message: n.body,
        read: n.read,
        link: n.ref_id,
        createdAt: n.created_at
      }));

      set({
        notifications: mapped,
        unreadCount: mapped.filter(n => !n.read).length,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      set({ loading: false });
    }
  },

  markAsRead: async (id) => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      set((state) => ({
        notifications: state.notifications.map(n =>
          n._id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) return;

      await supabase.from('notifications').update({ read: true }).eq('user_id', sessionData.session.user.id).eq('read', false);
      set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  },

  clearAllNotifications: async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) return;

      await supabase.from('notifications').delete().eq('user_id', sessionData.session.user.id);
      set({
        notifications: [],
        unreadCount: 0,
      });
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      throw error;
    }
  },

  deleteNotification: async (id) => {
    try {
      const notification = get().notifications.find(n => n._id === id);
      await supabase.from('notifications').delete().eq('id', id);
      set((state) => ({
        notifications: state.notifications.filter(n => n._id !== id),
        unreadCount: notification && !notification.read 
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount
      }));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  },

  initRealtime: (userId) => {
    if (!userId) return;

    if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "default") {
      window.Notification.requestPermission().catch(() => undefined);
    }

    if (notificationRealtimeChannel) {
      supabase.removeChannel(notificationRealtimeChannel);
    }
    
    // Subscribe to new notifications specific to this user
    notificationRealtimeChannel = supabase.channel('public:notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        const n = payload.new;
        get().addNotification({
          _id: n.id,
          user: n.user_id,
          type: n.type,
          title: n.title,
          message: n.body,
          read: n.read,
          link: n.ref_id,
          createdAt: n.created_at
        });

        toast.info(n.title || "New notification", {
          description: n.body || "You received a real-time update.",
        });
        
        // Use standard browser Notification API or generic toast
        if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
          new window.Notification(n.title, { body: n.body });
        }
      })
      .subscribe();
  }
}));
