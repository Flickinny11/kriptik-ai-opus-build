import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import { api } from '../lib/api';

export interface AppNotification {
  id: string;
  type: 'build' | 'agent' | 'training' | 'system' | 'chat';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  pushToken: string | null;
  permissionGranted: boolean;

  // Actions
  initialize: () => Promise<void>;
  addNotification: (notification: AppNotification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  setPushToken: (token: string) => void;
  fetchNotifications: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  pushToken: null,
  permissionGranted: false,

  initialize: async () => {
    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      set({ permissionGranted: finalStatus === 'granted' });

      if (finalStatus === 'granted') {
        // Get push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
        });
        
        const pushToken = tokenData.data;
        set({ pushToken });

        // Register token with backend
        await api.registerPushToken(pushToken);
      }

      // Fetch existing notifications
      await get().fetchNotifications();
    } catch (error) {
      console.error('Notification initialization failed:', error);
    }
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { notifications, unreadCount };
    });

    // Sync with backend
    api.markNotificationRead(id).catch(console.error);
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));

    // Sync with backend
    api.markAllNotificationsRead().catch(console.error);
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  setPushToken: (token) => {
    set({ pushToken: token });
  },

  fetchNotifications: async () => {
    try {
      const response = await api.getNotifications();
      
      if (response.success && response.data) {
        const notifications = response.data.notifications || [];
        const unreadCount = notifications.filter((n: AppNotification) => !n.read).length;
        set({ notifications, unreadCount });
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  },
}));
