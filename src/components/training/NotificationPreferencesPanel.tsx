/**
 * Notification Preferences Panel - Configure training notification settings
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authenticatedFetch, API_URL } from '@/lib/api-config';

interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  alertOnBudgetPercent: number;
  alertOnStageComplete: boolean;
  alertOnError: boolean;
  alertOnComplete: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
}

interface NotificationPreferencesPanelProps {
  onClose?: () => void;
}

export function NotificationPreferencesPanel({ onClose }: NotificationPreferencesPanelProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
    alertOnBudgetPercent: 80,
    alertOnStageComplete: true,
    alertOnError: true,
    alertOnComplete: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch current preferences
  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const response = await authenticatedFetch(`${API_URL}/api/training/notifications/preferences`);
        if (response.ok) {
          const data = await response.json();
          setPrefs(prev => ({ ...prev, ...data.preferences }));
        }
      } catch (error) {
        console.error('[NotificationPreferences] Fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrefs();
  }, []);

  // Save preferences
  const savePreferences = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/training/notifications/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Preferences saved successfully' });
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setIsSaving(false);
    }
  };

  // Send test notification
  const sendTestNotification = async () => {
    setIsTesting(true);
    setMessage(null);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/training/notifications/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'all' }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Test notification sent' });
      } else {
        throw new Error('Failed to send test notification');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send test notification' });
    } finally {
      setIsTesting(false);
    }
  };

  // Update preference
  const updatePref = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 mx-auto border-2 border-white/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Notification Preferences</h3>
          <p className="text-sm text-white/60">Configure how you receive training notifications</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Channel Preferences */}
      <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
        <h4 className="text-sm font-medium text-white/80">Notification Channels</h4>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-white">In-App Notifications</span>
            <p className="text-xs text-white/40">Show notifications in the app</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.inAppEnabled}
            onChange={(e) => updatePref('inAppEnabled', e.target.checked)}
            className="w-5 h-5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-white">Email Notifications</span>
            <p className="text-xs text-white/40">Send notifications to your email</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.emailEnabled}
            onChange={(e) => updatePref('emailEnabled', e.target.checked)}
            className="w-5 h-5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-white">SMS Notifications</span>
            <p className="text-xs text-white/40">Send text messages for critical alerts</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.smsEnabled}
            onChange={(e) => updatePref('smsEnabled', e.target.checked)}
            className="w-5 h-5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
          />
        </label>
      </div>

      {/* Event Preferences */}
      <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
        <h4 className="text-sm font-medium text-white/80">Event Notifications</h4>

        <div className="space-y-2">
          <label className="flex items-center justify-between text-sm">
            <span className="text-white/60">Budget Alert Threshold</span>
            <span className="text-white">{prefs.alertOnBudgetPercent}%</span>
          </label>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={prefs.alertOnBudgetPercent}
            onChange={(e) => updatePref('alertOnBudgetPercent', parseInt(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <p className="text-xs text-white/40">
            Alert when budget usage reaches this percentage
          </p>
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-white">Stage Completion</span>
            <p className="text-xs text-white/40">Notify when a training stage completes</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.alertOnStageComplete}
            onChange={(e) => updatePref('alertOnStageComplete', e.target.checked)}
            className="w-5 h-5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-white">Training Completion</span>
            <p className="text-xs text-white/40">Notify when training finishes</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.alertOnComplete}
            onChange={(e) => updatePref('alertOnComplete', e.target.checked)}
            className="w-5 h-5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-white">Error Notifications</span>
            <p className="text-xs text-white/40">Notify on training errors</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.alertOnError}
            onChange={(e) => updatePref('alertOnError', e.target.checked)}
            className="w-5 h-5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
          />
        </label>
      </div>

      {/* Quiet Hours */}
      <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <h4 className="text-sm font-medium text-white/80">Quiet Hours</h4>
            <p className="text-xs text-white/40">Pause non-critical notifications</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.quietHoursEnabled}
            onChange={(e) => updatePref('quietHoursEnabled', e.target.checked)}
            className="w-5 h-5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
          />
        </label>

        {prefs.quietHoursEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs text-white/60 mb-1">Start Time</label>
              <input
                type="time"
                value={prefs.quietHoursStart}
                onChange={(e) => updatePref('quietHoursStart', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">End Time</label>
              <input
                type="time"
                value={prefs.quietHoursEnd}
                onChange={(e) => updatePref('quietHoursEnd', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={sendTestNotification}
          disabled={isTesting}
          className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isTesting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            'Send Test Notification'
          )}
        </button>
        <button
          onClick={savePreferences}
          disabled={isSaving}
          className="flex-1 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default NotificationPreferencesPanel;
