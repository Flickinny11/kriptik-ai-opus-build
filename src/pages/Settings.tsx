/**
 * Settings Page
 *
 * Comprehensive settings and account management
 * Includes:
 * - Mobile App Settings
 * - Notification Preferences
 * - Build Preferences
 * - UI Preferences
 * - Account Security
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/store/useUserStore';
import { apiClient } from '@/lib/api-client';

// Settings types
interface UserSettings {
  // Mobile App Settings
  defaultBuildPlatform: 'ios' | 'android' | 'all';
  defaultDistribution: 'development' | 'internal' | 'store';
  expoAccountConnected: boolean;
  appleDevConnected: boolean;
  googlePlayConnected: boolean;

  // Notification Preferences
  pushNotifications: boolean;
  emailNotifications: boolean;
  mobileNotifications: boolean;
  notifyBuildStarted: boolean;
  notifyBuildPhaseComplete: boolean;
  notifyBuildComplete: boolean;
  notifyBuildFailed: boolean;
  notifyFeatureAgentComplete: boolean;
  notifyVerificationIssues: boolean;

  // Build Preferences
  defaultBuildType: 'web' | 'mobile';
  defaultModel: string;
  defaultSpeedMode: 'lightning' | 'standard' | 'tournament' | 'production';
  autoMergeOnPass: boolean;
  showVerificationWindow: 'always' | 'auto' | 'never';

  // UI Preferences
  theme: 'dark' | 'light' | 'system';
  panelLayoutDefault: number;
  codeEditorTheme: string;
  fontSize: number;
  animationSpeed: 'normal' | 'reduced' | 'off';

  // Mobile Companion
  biometricAuth: boolean;
  offlineMode: boolean;
}

interface LinkedDevice {
  id: string;
  name: string;
  platform: 'ios' | 'android';
  lastActive: string;
  isCurrent: boolean;
}

const defaultSettings: UserSettings = {
  defaultBuildPlatform: 'all',
  defaultDistribution: 'development',
  expoAccountConnected: false,
  appleDevConnected: false,
  googlePlayConnected: false,
  pushNotifications: true,
  emailNotifications: true,
  mobileNotifications: true,
  notifyBuildStarted: true,
  notifyBuildPhaseComplete: false,
  notifyBuildComplete: true,
  notifyBuildFailed: true,
  notifyFeatureAgentComplete: true,
  notifyVerificationIssues: true,
  defaultBuildType: 'web',
  defaultModel: 'claude-sonnet-4',
  defaultSpeedMode: 'standard',
  autoMergeOnPass: false,
  showVerificationWindow: 'auto',
  theme: 'dark',
  panelLayoutDefault: 40,
  codeEditorTheme: 'kriptik-dark',
  fontSize: 14,
  animationSpeed: 'normal',
  biometricAuth: true,
  offlineMode: false,
};

type SettingsSection =
  | 'mobile'
  | 'notifications'
  | 'build'
  | 'ui'
  | 'security'
  | 'companion';

export default function SettingsPage() {
  const { user } = useUserStore();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [activeSection, setActiveSection] = useState<SettingsSection>('build');
  const [isLoading, setIsLoading] = useState(true);
  const [_isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadSettings();
    loadDevices();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiClient.get<{ settings: UserSettings }>(
        '/api/user/settings'
      );
      if (response?.data?.settings) {
        setSettings({ ...defaultSettings, ...response.data.settings });
      }
    } catch {
      // Use defaults
    } finally {
      setIsLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const response = await apiClient.get<{ devices: LinkedDevice[] }>(
        '/api/user/devices'
      );
      if (response?.data?.devices) {
        setDevices(response.data.devices);
      }
    } catch {
      // Ignore
    }
  };

  const saveSettings = async (updates: Partial<UserSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    setIsSaving(true);

    try {
      await apiClient.patch('/api/user/settings', { settings: newSettings });
    } catch {
      // Revert on error
      setSettings(settings);
    } finally {
      setIsSaving(false);
    }
  };

  const removeDevice = async (deviceId: string) => {
    try {
      await apiClient.delete(`/api/user/devices/${deviceId}`);
      setDevices(devices.filter((d) => d.id !== deviceId));
    } catch {
      // Handle error
    }
  };

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    {
      id: 'build',
      label: 'Build Preferences',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </svg>
      ),
    },
    {
      id: 'mobile',
      label: 'Mobile App',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="2" width="14" height="20" rx="3" />
          <path d="M12 18h.01" />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      ),
    },
    {
      id: 'ui',
      label: 'Appearance',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      id: 'companion',
      label: 'Mobile Companion',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
    },
    {
      id: 'security',
      label: 'Security',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0C0A09',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid #F59E0B20',
            borderTopColor: '#F59E0B',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0C0A09',
        padding: '32px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: '8px',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Settings
          </h1>
          <p style={{ fontSize: '14px', color: '#A8A29E' }}>
            Manage your account and preferences
          </p>
        </div>

        <div style={{ display: 'flex', gap: '32px' }}>
          {/* Sidebar */}
          <nav
            style={{
              width: '240px',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                backgroundColor: '#1C1917',
                borderRadius: '16px',
                border: '1px solid #292524',
                overflow: 'hidden',
              }}
            >
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backgroundColor:
                      activeSection === section.id ? '#F59E0B10' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #292524',
                    cursor: 'pointer',
                    color: activeSection === section.id ? '#F59E0B' : '#A8A29E',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {section.icon}
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>
                    {section.label}
                  </span>
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <main style={{ flex: 1 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeSection === 'build' && (
                  <BuildPreferencesSection
                    settings={settings}
                    onSave={saveSettings}
                  />
                )}
                {activeSection === 'mobile' && (
                  <MobileAppSection
                    settings={settings}
                    onSave={saveSettings}
                  />
                )}
                {activeSection === 'notifications' && (
                  <NotificationsSection
                    settings={settings}
                    onSave={saveSettings}
                  />
                )}
                {activeSection === 'ui' && (
                  <AppearanceSection
                    settings={settings}
                    onSave={saveSettings}
                  />
                )}
                {activeSection === 'companion' && (
                  <CompanionSection
                    settings={settings}
                    devices={devices}
                    onSave={saveSettings}
                    onRemoveDevice={removeDevice}
                  />
                )}
                {activeSection === 'security' && (
                  <SecuritySection
                    user={user}
                    onDeleteAccount={() => setShowDeleteConfirm(true)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Delete account confirmation */}
      {showDeleteConfirm && (
        <DeleteAccountModal onClose={() => setShowDeleteConfirm(false)} />
      )}
    </div>
  );
}

// Section Components

function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: '#1C1917',
        borderRadius: '16px',
        border: '1px solid #292524',
        marginBottom: '20px',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #292524',
        }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>
          {title}
        </h2>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid #292524',
      }}
    >
      <div>
        <div style={{ fontSize: '14px', color: '#FFFFFF' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '12px', color: '#78716C', marginTop: '2px' }}>
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          backgroundColor: value ? '#F59E0B' : '#292524',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background-color 0.2s ease',
        }}
      >
        <motion.div
          animate={{ x: value ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
            position: 'absolute',
            top: '2px',
            left: '2px',
          }}
        />
      </button>
    </div>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid #292524',
      }}
    >
      <div style={{ fontSize: '14px', color: '#FFFFFF' }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #292524',
          backgroundColor: '#0C0A09',
          color: '#FFFFFF',
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function BuildPreferencesSection({
  settings,
  onSave,
}: {
  settings: UserSettings;
  onSave: (updates: Partial<UserSettings>) => void;
}) {
  return (
    <>
      <SettingsCard title="Build Configuration">
        <SelectRow
          label="Default Build Type"
          value={settings.defaultBuildType}
          options={[
            { value: 'web', label: 'Web App' },
            { value: 'mobile', label: 'Mobile App' },
          ]}
          onChange={(v) => onSave({ defaultBuildType: v as 'web' | 'mobile' })}
        />
        <SelectRow
          label="Default AI Model"
          value={settings.defaultModel}
          options={[
            { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
            { value: 'claude-opus-4', label: 'Claude Opus 4' },
            { value: 'claude-haiku', label: 'Claude Haiku' },
            { value: 'gpt-4', label: 'GPT-4' },
          ]}
          onChange={(v) => onSave({ defaultModel: v })}
        />
        <SelectRow
          label="Default Speed Mode"
          value={settings.defaultSpeedMode}
          options={[
            { value: 'lightning', label: 'Lightning (Fastest)' },
            { value: 'standard', label: 'Standard' },
            { value: 'tournament', label: 'Tournament (Best Quality)' },
            { value: 'production', label: 'Production' },
          ]}
          onChange={(v) =>
            onSave({
              defaultSpeedMode: v as
                | 'lightning'
                | 'standard'
                | 'tournament'
                | 'production',
            })
          }
        />
      </SettingsCard>

      <SettingsCard title="Verification">
        <ToggleRow
          label="Auto-merge on verification pass"
          description="Automatically merge changes when all verification passes"
          value={settings.autoMergeOnPass}
          onChange={(v) => onSave({ autoMergeOnPass: v })}
        />
        <SelectRow
          label="Verification Window"
          value={settings.showVerificationWindow}
          options={[
            { value: 'always', label: 'Always Show' },
            { value: 'auto', label: 'Auto (Show on Issues)' },
            { value: 'never', label: 'Never' },
          ]}
          onChange={(v) =>
            onSave({ showVerificationWindow: v as 'always' | 'auto' | 'never' })
          }
        />
      </SettingsCard>
    </>
  );
}

function MobileAppSection({
  settings,
  onSave,
}: {
  settings: UserSettings;
  onSave: (updates: Partial<UserSettings>) => void;
}) {
  return (
    <>
      <SettingsCard title="Connected Accounts">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <AccountConnectionRow
            name="Apple Developer"
            connected={settings.appleDevConnected}
            onConnect={() => {
              // Handle connection
            }}
          />
          <AccountConnectionRow
            name="Google Play Console"
            connected={settings.googlePlayConnected}
            onConnect={() => {
              // Handle connection
            }}
          />
          <AccountConnectionRow
            name="Expo Account"
            connected={settings.expoAccountConnected}
            onConnect={() => {
              // Handle connection
            }}
          />
        </div>
      </SettingsCard>

      <SettingsCard title="Build Defaults">
        <SelectRow
          label="Default Platform"
          value={settings.defaultBuildPlatform}
          options={[
            { value: 'ios', label: 'iOS' },
            { value: 'android', label: 'Android' },
            { value: 'all', label: 'Both' },
          ]}
          onChange={(v) =>
            onSave({ defaultBuildPlatform: v as 'ios' | 'android' | 'all' })
          }
        />
        <SelectRow
          label="Default Distribution"
          value={settings.defaultDistribution}
          options={[
            { value: 'development', label: 'Development' },
            { value: 'internal', label: 'Internal' },
            { value: 'store', label: 'App Store' },
          ]}
          onChange={(v) =>
            onSave({
              defaultDistribution: v as 'development' | 'internal' | 'store',
            })
          }
        />
      </SettingsCard>
    </>
  );
}

function AccountConnectionRow({
  name,
  connected,
  onConnect,
}: {
  name: string;
  connected: boolean;
  onConnect: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        backgroundColor: '#0C0A09',
        borderRadius: '10px',
        border: '1px solid #292524',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '4px',
            backgroundColor: connected ? '#22C55E' : '#57534E',
          }}
        />
        <span style={{ fontSize: '14px', color: '#FFFFFF' }}>{name}</span>
      </div>
      <button
        onClick={onConnect}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: `1px solid ${connected ? '#22C55E30' : '#F59E0B30'}`,
          backgroundColor: connected ? '#22C55E10' : '#F59E0B10',
          color: connected ? '#22C55E' : '#F59E0B',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {connected ? 'Connected' : 'Connect'}
      </button>
    </div>
  );
}

function NotificationsSection({
  settings,
  onSave,
}: {
  settings: UserSettings;
  onSave: (updates: Partial<UserSettings>) => void;
}) {
  return (
    <>
      <SettingsCard title="Notification Channels">
        <ToggleRow
          label="Push Notifications"
          description="Browser push notifications"
          value={settings.pushNotifications}
          onChange={(v) => onSave({ pushNotifications: v })}
        />
        <ToggleRow
          label="Email Notifications"
          description="Send updates to your email"
          value={settings.emailNotifications}
          onChange={(v) => onSave({ emailNotifications: v })}
        />
        <ToggleRow
          label="Mobile App Notifications"
          description="Notifications in KripTik mobile app"
          value={settings.mobileNotifications}
          onChange={(v) => onSave({ mobileNotifications: v })}
        />
      </SettingsCard>

      <SettingsCard title="Notification Events">
        <ToggleRow
          label="Build Started"
          value={settings.notifyBuildStarted}
          onChange={(v) => onSave({ notifyBuildStarted: v })}
        />
        <ToggleRow
          label="Build Phase Complete"
          value={settings.notifyBuildPhaseComplete}
          onChange={(v) => onSave({ notifyBuildPhaseComplete: v })}
        />
        <ToggleRow
          label="Build Complete"
          value={settings.notifyBuildComplete}
          onChange={(v) => onSave({ notifyBuildComplete: v })}
        />
        <ToggleRow
          label="Build Failed"
          value={settings.notifyBuildFailed}
          onChange={(v) => onSave({ notifyBuildFailed: v })}
        />
        <ToggleRow
          label="Feature Agent Complete"
          value={settings.notifyFeatureAgentComplete}
          onChange={(v) => onSave({ notifyFeatureAgentComplete: v })}
        />
        <ToggleRow
          label="Verification Issues"
          value={settings.notifyVerificationIssues}
          onChange={(v) => onSave({ notifyVerificationIssues: v })}
        />
      </SettingsCard>
    </>
  );
}

function AppearanceSection({
  settings,
  onSave,
}: {
  settings: UserSettings;
  onSave: (updates: Partial<UserSettings>) => void;
}) {
  return (
    <>
      <SettingsCard title="Theme">
        <SelectRow
          label="Color Theme"
          value={settings.theme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
          onChange={(v) => onSave({ theme: v as 'dark' | 'light' | 'system' })}
        />
        <SelectRow
          label="Code Editor Theme"
          value={settings.codeEditorTheme}
          options={[
            { value: 'kriptik-dark', label: 'KripTik Dark' },
            { value: 'monokai', label: 'Monokai' },
            { value: 'github-dark', label: 'GitHub Dark' },
          ]}
          onChange={(v) => onSave({ codeEditorTheme: v })}
        />
      </SettingsCard>

      <SettingsCard title="Layout">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid #292524',
          }}
        >
          <div>
            <div style={{ fontSize: '14px', color: '#FFFFFF' }}>
              Default Panel Width
            </div>
            <div style={{ fontSize: '12px', color: '#78716C', marginTop: '2px' }}>
              {settings.panelLayoutDefault}% chat panel width
            </div>
          </div>
          <input
            type="range"
            min="20"
            max="60"
            value={settings.panelLayoutDefault}
            onChange={(e) =>
              onSave({ panelLayoutDefault: parseInt(e.target.value) })
            }
            style={{ width: '120px' }}
          />
        </div>
        <SelectRow
          label="Font Size"
          value={settings.fontSize.toString()}
          options={[
            { value: '12', label: '12px' },
            { value: '13', label: '13px' },
            { value: '14', label: '14px' },
            { value: '15', label: '15px' },
            { value: '16', label: '16px' },
          ]}
          onChange={(v) => onSave({ fontSize: parseInt(v) })}
        />
        <SelectRow
          label="Animation Speed"
          value={settings.animationSpeed}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'reduced', label: 'Reduced' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(v) =>
            onSave({ animationSpeed: v as 'normal' | 'reduced' | 'off' })
          }
        />
      </SettingsCard>
    </>
  );
}

function CompanionSection({
  settings,
  devices,
  onSave,
  onRemoveDevice,
}: {
  settings: UserSettings;
  devices: LinkedDevice[];
  onSave: (updates: Partial<UserSettings>) => void;
  onRemoveDevice: (id: string) => void;
}) {
  return (
    <>
      <SettingsCard title="Mobile Companion App">
        <ToggleRow
          label="Biometric Authentication"
          description="Use Face ID / Touch ID / Fingerprint"
          value={settings.biometricAuth}
          onChange={(v) => onSave({ biometricAuth: v })}
        />
        <ToggleRow
          label="Offline Mode"
          description="Cache data for offline access"
          value={settings.offlineMode}
          onChange={(v) => onSave({ offlineMode: v })}
        />
      </SettingsCard>

      <SettingsCard title="Linked Devices">
        {devices.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#A8A29E', fontSize: '14px', marginBottom: '16px' }}>
              No devices linked yet
            </p>
            <p style={{ color: '#78716C', fontSize: '12px' }}>
              Download the KripTik app and sign in to link your device
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {devices.map((device) => (
              <div
                key={device.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: '#0C0A09',
                  borderRadius: '10px',
                  border: '1px solid #292524',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', color: '#FFFFFF' }}>
                    {device.name}
                    {device.isCurrent && (
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '10px',
                          color: '#22C55E',
                          textTransform: 'uppercase',
                        }}
                      >
                        Current
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#78716C' }}>
                    {device.platform === 'ios' ? 'iOS' : 'Android'} - Last active{' '}
                    {device.lastActive}
                  </div>
                </div>
                {!device.isCurrent && (
                  <button
                    onClick={() => onRemoveDevice(device.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #EF444430',
                      backgroundColor: '#EF444410',
                      color: '#EF4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Quick Link">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#0C0A09', fontSize: '12px' }}>QR Code</span>
          </div>
          <div>
            <p style={{ color: '#FFFFFF', fontSize: '14px', marginBottom: '8px' }}>
              Scan to link your mobile device
            </p>
            <p style={{ color: '#78716C', fontSize: '12px' }}>
              Open the KripTik mobile app and scan this QR code to instantly link
              your device.
            </p>
          </div>
        </div>
      </SettingsCard>
    </>
  );
}

function SecuritySection({
  user,
  onDeleteAccount,
}: {
  user: { email?: string; name?: string } | null;
  onDeleteAccount: () => void;
}) {
  return (
    <>
      <SettingsCard title="Account">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 0',
            borderBottom: '1px solid #292524',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '24px',
              backgroundColor: '#F59E0B20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 600,
              color: '#F59E0B',
            }}
          >
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#FFFFFF' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '13px', color: '#A8A29E' }}>
              {user?.email || 'No email'}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Password">
        <button
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid #292524',
            backgroundColor: '#0C0A09',
            color: '#FFFFFF',
            fontSize: '14px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          Change Password
        </button>
      </SettingsCard>

      <SettingsCard title="Two-Factor Authentication">
        <p style={{ color: '#A8A29E', fontSize: '13px', marginBottom: '16px' }}>
          Add an extra layer of security to your account
        </p>
        <button
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid #22C55E30',
            backgroundColor: '#22C55E10',
            color: '#22C55E',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Enable 2FA
        </button>
      </SettingsCard>

      <SettingsCard title="Danger Zone">
        <p style={{ color: '#A8A29E', fontSize: '13px', marginBottom: '16px' }}>
          Permanently delete your account and all associated data
        </p>
        <button
          onClick={onDeleteAccount}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid #EF444440',
            backgroundColor: '#EF444415',
            color: '#EF4444',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Delete Account
        </button>
      </SettingsCard>
    </>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText === 'DELETE';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '400px',
          padding: '24px',
          backgroundColor: '#1C1917',
          borderRadius: '16px',
          border: '1px solid #EF444440',
        }}
      >
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#EF4444',
            marginBottom: '12px',
          }}
        >
          Delete Account
        </h3>
        <p
          style={{
            fontSize: '14px',
            color: '#A8A29E',
            marginBottom: '20px',
            lineHeight: 1.5,
          }}
        >
          This action cannot be undone. All your projects, builds, and data will be
          permanently deleted.
        </p>
        <p
          style={{
            fontSize: '13px',
            color: '#FFFFFF',
            marginBottom: '12px',
          }}
        >
          Type <strong>DELETE</strong> to confirm:
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #292524',
            backgroundColor: '#0C0A09',
            color: '#FFFFFF',
            fontSize: '14px',
            marginBottom: '20px',
          }}
        />
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid #292524',
              backgroundColor: 'transparent',
              color: '#A8A29E',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!canDelete}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: canDelete ? '#EF4444' : '#292524',
              color: canDelete ? '#FFFFFF' : '#57534E',
              fontSize: '14px',
              fontWeight: 600,
              cursor: canDelete ? 'pointer' : 'not-allowed',
            }}
          >
            Delete Account
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
