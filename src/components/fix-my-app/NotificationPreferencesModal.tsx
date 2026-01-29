/**
 * NotificationPreferencesModal
 * 
 * Modal for setting up notification preferences (SMS, Email, Push)
 * for credential requests and build status updates.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XIcon,
  BellIcon,
  MessageSquareIcon,
  SmartphoneIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from '../ui/icons';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api-client';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (preferences: NotificationPreferences) => void;
  projectId?: string;
}

interface NotificationPreferences {
  sms: boolean;
  email: boolean;
  push: boolean;
  inApp: boolean;
  phoneNumber?: string;
  emailAddress?: string;
}

const primaryButtonStyles: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  padding: '14px 28px',
  borderRadius: '14px',
  fontWeight: 600,
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  background: 'linear-gradient(135deg, rgba(251,191,36,0.95) 0%, rgba(249,115,22,0.95) 50%, rgba(239,68,68,0.9) 100%)',
  color: 'white',
  border: '1px solid rgba(255,255,255,0.25)',
  boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(251,146,60,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
  cursor: 'pointer',
  transition: 'all 0.15s ease-out',
};

const secondaryButtonStyles: React.CSSProperties = {
  position: 'relative',
  padding: '12px 24px',
  borderRadius: '12px',
  fontWeight: 500,
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  background: 'rgba(30, 41, 59, 0.5)',
  color: '#e2e8f0',
  border: '1px solid rgba(100, 116, 139, 0.4)',
  cursor: 'pointer',
  transition: 'all 0.15s ease-out',
};

export function NotificationPreferencesModal({
  isOpen,
  onClose,
  onSave,
  projectId: _projectId, // Reserved for future project-specific preferences
}: NotificationPreferencesModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    sms: false,
    email: true,
    push: false,
    inApp: true,
    phoneNumber: '',
    emailAddress: '',
  });

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Validate phone number if SMS is enabled
      if (preferences.sms && !preferences.phoneNumber) {
        toast({
          title: 'Phone number required',
          description: 'Please enter your phone number to enable SMS notifications.',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      // Validate email if email notifications enabled
      if (preferences.email && !preferences.emailAddress) {
        toast({
          title: 'Email required',
          description: 'Please enter your email address to enable email notifications.',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      // Save preferences to server - use the existing notification preferences endpoint
      await apiClient.post('/api/notifications/preferences', {
        email: preferences.emailAddress || null,
        phone: preferences.phoneNumber || null,
        pushEnabled: preferences.push,
        // pushSubscription will be set separately when push permission is granted
      });

      // Request push notification permission if enabled
      if (preferences.push && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast({
            title: 'Push notifications blocked',
            description: 'Enable notifications in your browser settings to receive push alerts.',
          });
        }
      }

      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.',
      });

      onSave?.(preferences);
      onClose();
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      toast({
        title: 'Failed to save',
        description: 'There was an error saving your preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    // Still save with in-app only
    setPreferences(prev => ({
      ...prev,
      sms: false,
      email: false,
      push: false,
      inApp: true,
    }));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
                  <BellIcon size={20} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Stay Updated</h2>
                  <p className="text-sm text-slate-400">Get notified when we need credentials or your app is ready</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <XIcon size={20} className="text-slate-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* SMS Option */}
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 cursor-pointer hover:bg-slate-800/70 transition-colors">
                <div className="flex items-center gap-3">
                  <SmartphoneIcon size={20} className="text-slate-400" />
                  <div>
                    <span className="font-medium text-white">SMS Notifications</span>
                    <p className="text-xs text-slate-400">Get text messages for critical updates</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.sms}
                  onChange={(e) => setPreferences(prev => ({ ...prev, sms: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500/50"
                />
              </label>

              {preferences.sms && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pl-4"
                >
                  <input
                    type="tel"
                    value={preferences.phoneNumber}
                    onChange={(e) => setPreferences(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none"
                  />
                </motion.div>
              )}
            </div>

            {/* Email Option */}
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 cursor-pointer hover:bg-slate-800/70 transition-colors">
                <div className="flex items-center gap-3">
                  <MessageSquareIcon size={20} className="text-slate-400" />
                  <div>
                    <span className="font-medium text-white">Email Notifications</span>
                    <p className="text-xs text-slate-400">Receive email updates with detailed info</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.email}
                  onChange={(e) => setPreferences(prev => ({ ...prev, email: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500/50"
                />
              </label>

              {preferences.email && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pl-4"
                >
                  <input
                    type="email"
                    value={preferences.emailAddress}
                    onChange={(e) => setPreferences(prev => ({ ...prev, emailAddress: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none"
                  />
                </motion.div>
              )}
            </div>

            {/* Push Option */}
            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 cursor-pointer hover:bg-slate-800/70 transition-colors">
              <div className="flex items-center gap-3">
                <BellIcon size={20} className="text-slate-400" />
                <div>
                  <span className="font-medium text-white">Push Notifications</span>
                  <p className="text-xs text-slate-400">Desktop/mobile browser alerts</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.push}
                onChange={(e) => setPreferences(prev => ({ ...prev, push: e.target.checked }))}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500/50"
              />
            </label>

            {/* In-App (always on) */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-3">
                <CheckCircle2Icon size={20} className="text-emerald-400" />
                <div>
                  <span className="font-medium text-white">In-App Notifications</span>
                  <p className="text-xs text-slate-400">Always enabled in your KripTik dashboard</p>
                </div>
              </div>
              <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                Always On
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-700 flex gap-3">
            <button
              onClick={handleSkip}
              style={secondaryButtonStyles}
              className="flex-1 hover:bg-slate-600/60"
            >
              Skip for now
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={primaryButtonStyles}
              className="flex-1 flex items-center justify-center gap-2 hover:translate-y-[2px] active:translate-y-[4px] disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2Icon size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Enable Notifications'
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default NotificationPreferencesModal;
