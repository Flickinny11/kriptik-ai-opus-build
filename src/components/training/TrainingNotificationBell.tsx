/**
 * Training Notification Bell - Training-specific notification indicator
 *
 * Shows training notifications with quick actions for resume, test, etc.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authenticatedFetch, API_URL } from '@/lib/api-config';

interface TrainingNotification {
  id: string;
  type: 'training_alert' | 'training_freeze' | 'training_complete' | 'training_error' | 'training_stage_complete';
  title: string;
  message: string;
  actionUrl: string;
  metadata: {
    jobId?: string;
    jobName?: string;
    actionLabel?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    percentUsed?: number;
    currentSpend?: number;
    finalLoss?: number;
    totalCost?: number;
    resumeUrl?: string;
    [key: string]: unknown;
  };
  read: boolean;
  createdAt: string;
}

interface TrainingNotificationBellProps {
  className?: string;
}

export function TrainingNotificationBell({ className = '' }: TrainingNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<TrainingNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/api/notifications?limit=20`);
      if (response.ok) {
        const data = await response.json();
        // Filter to only training notifications
        const trainingNotifs = (data.notifications || []).filter((n: TrainingNotification) => 
          n.type?.startsWith('training_')
        );
        setNotifications(trainingNotifs);
        setUnreadCount(trainingNotifs.filter((n: TrainingNotification) => !n.read).length);
      }
    } catch (error) {
      console.error('[TrainingNotificationBell] Fetch error:', error);
    }
  }, []);

  // Set up SSE for real-time notifications
  useEffect(() => {
    fetchNotifications();

    // Connect to SSE stream
    const connectSSE = () => {
      const eventSource = new EventSource(`${API_URL}/api/training/notifications/stream`, {
        withCredentials: true,
      });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            const newNotif = data.payload as TrainingNotification;
            setNotifications(prev => [newNotif, ...prev.slice(0, 19)]);
            setUnreadCount(prev => prev + 1);
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };

      eventSourceRef.current = eventSource;
    };

    connectSSE();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [fetchNotifications]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark notification as read
  const markRead = async (id: string) => {
    try {
      await authenticatedFetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'POST',
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[TrainingNotificationBell] Mark read error:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notif: TrainingNotification) => {
    if (!notif.read) {
      markRead(notif.id);
    }
    if (notif.actionUrl) {
      window.location.href = notif.actionUrl;
    }
    setIsOpen(false);
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: TrainingNotification['type']) => {
    switch (type) {
      case 'training_alert':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#f59e0b" strokeWidth="2" />
            <line x1="12" y1="9" x2="12" y2="13" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'training_freeze':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
            <rect x="10" y="8" width="4" height="8" rx="1" fill="#ef4444" />
          </svg>
        );
      case 'training_complete':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="2" />
            <path d="M8 12l3 3 5-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'training_error':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
            <path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'training_stage_complete':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v20M17 5l-5 5-5-5M17 19l-5-5-5 5" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" />
            <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" />
          </svg>
        );
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        title="Training Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden rounded-xl bg-stone-800/95 backdrop-blur-xl border border-white/10 shadow-xl z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Training Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-white/40">{unreadCount} unread</span>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-white/40 text-sm">
                  No training notifications yet
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 ${
                      !notif.read ? 'bg-white/5' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium truncate ${notif.read ? 'text-white/70' : 'text-white'}`}>
                            {notif.title}
                          </p>
                          {notif.metadata?.priority && (
                            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${getPriorityColor(notif.metadata.priority)}`} />
                          )}
                        </div>
                        <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-white/30">
                            {formatTimeAgo(notif.createdAt)}
                          </span>
                          {notif.metadata?.actionLabel && (
                            <span className="text-xs text-cyan-400">
                              {notif.metadata.actionLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-white/10">
                <a
                  href="/dashboard/notifications"
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  View all notifications
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TrainingNotificationBell;
