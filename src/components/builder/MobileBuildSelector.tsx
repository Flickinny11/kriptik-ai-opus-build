/**
 * Mobile Build Selector
 *
 * UI component for configuring mobile app builds
 * Allows users to select:
 * - Target platform (iOS, Android, Both)
 * - Device types
 * - Distribution type
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type Platform = 'ios' | 'android' | 'all';
export type Distribution = 'development' | 'internal' | 'store';

export interface MobileBuildConfig {
  platform: Platform;
  distribution: Distribution;
  iosDevices: ('iphone' | 'ipad')[];
  androidDevices: ('phone' | 'tablet')[];
  appName: string;
  bundleId: string;
}

interface MobileBuildSelectorProps {
  onConfigChange: (config: MobileBuildConfig) => void;
  initialConfig?: Partial<MobileBuildConfig>;
}

const defaultConfig: MobileBuildConfig = {
  platform: 'all',
  distribution: 'development',
  iosDevices: ['iphone'],
  androidDevices: ['phone'],
  appName: '',
  bundleId: '',
};

export function MobileBuildSelector({
  onConfigChange,
  initialConfig,
}: MobileBuildSelectorProps) {
  const [config, setConfig] = useState<MobileBuildConfig>({
    ...defaultConfig,
    ...initialConfig,
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const updateConfig = (updates: Partial<MobileBuildConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const platforms: { value: Platform; label: string; icon: React.ReactNode }[] = [
    {
      value: 'ios',
      label: 'iOS',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="2" width="14" height="20" rx="3" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      value: 'android',
      label: 'Android',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M9 18h6" />
        </svg>
      ),
    },
    {
      value: 'all',
      label: 'Both',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="8" height="16" rx="2" />
          <rect x="13" y="4" width="8" height="16" rx="2" />
        </svg>
      ),
    },
  ];

  const distributions: { value: Distribution; label: string; description: string }[] = [
    { value: 'development', label: 'Development', description: 'Testing on your device' },
    { value: 'internal', label: 'Internal', description: 'Share with your team' },
    { value: 'store', label: 'App Store', description: 'Submit to stores' },
  ];

  return (
    <div
      style={{
        backgroundColor: '#1C1917',
        borderRadius: '16px',
        border: '1px solid #292524',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#F59E0B15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F59E0B',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="3" />
              <path d="M12 18h.01" />
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
              }}
            >
              Mobile App Build
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#A8A29E',
              }}
            >
              {config.platform === 'all' ? 'iOS & Android' : config.platform.toUpperCase()} - {config.distribution}
            </div>
          </div>
        </div>

        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#A8A29E"
          strokeWidth="2"
          animate={{ rotate: isExpanded ? 180 : 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '16px',
                paddingTop: '0',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Platform Selection */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#A8A29E',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Target Platform
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {platforms.map((p) => (
                    <motion.button
                      key={p.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateConfig({ platform: p.value })}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '12px',
                        border: `1px solid ${
                          config.platform === p.value ? '#F59E0B50' : '#292524'
                        }`,
                        backgroundColor:
                          config.platform === p.value ? '#F59E0B15' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          color: config.platform === p.value ? '#F59E0B' : '#A8A29E',
                        }}
                      >
                        {p.icon}
                      </div>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: config.platform === p.value ? '#F59E0B' : '#A8A29E',
                        }}
                      >
                        {p.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Distribution Type */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#A8A29E',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Distribution
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {distributions.map((d) => (
                    <motion.button
                      key={d.value}
                      whileHover={{ x: 2 }}
                      onClick={() => updateConfig({ distribution: d.value })}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: `1px solid ${
                          config.distribution === d.value ? '#F59E0B50' : '#292524'
                        }`,
                        backgroundColor:
                          config.distribution === d.value ? '#F59E0B10' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color:
                              config.distribution === d.value ? '#FFFFFF' : '#D6D3D1',
                          }}
                        >
                          {d.label}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#78716C',
                          }}
                        >
                          {d.description}
                        </div>
                      </div>
                      {config.distribution === d.value && (
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#F59E0B',
                          }}
                        />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* iOS Device Selection */}
              {(config.platform === 'ios' || config.platform === 'all') && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#A8A29E',
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    iOS Devices
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['iphone', 'ipad'] as const).map((device) => {
                      const isSelected = config.iosDevices.includes(device);
                      return (
                        <motion.button
                          key={device}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            const newDevices = isSelected
                              ? config.iosDevices.filter((d) => d !== device)
                              : [...config.iosDevices, device];
                            if (newDevices.length > 0) {
                              updateConfig({ iosDevices: newDevices });
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: `1px solid ${isSelected ? '#14B8A650' : '#292524'}`,
                            backgroundColor: isSelected ? '#14B8A615' : 'transparent',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: isSelected ? '#14B8A6' : '#A8A29E',
                          }}
                        >
                          {device === 'iphone' ? 'iPhone' : 'iPad'}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Android Device Selection */}
              {(config.platform === 'android' || config.platform === 'all') && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#A8A29E',
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Android Devices
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['phone', 'tablet'] as const).map((device) => {
                      const isSelected = config.androidDevices.includes(device);
                      return (
                        <motion.button
                          key={device}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            const newDevices = isSelected
                              ? config.androidDevices.filter((d) => d !== device)
                              : [...config.androidDevices, device];
                            if (newDevices.length > 0) {
                              updateConfig({ androidDevices: newDevices });
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: `1px solid ${isSelected ? '#22C55E50' : '#292524'}`,
                            backgroundColor: isSelected ? '#22C55E15' : 'transparent',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: isSelected ? '#22C55E' : '#A8A29E',
                          }}
                        >
                          {device === 'phone' ? 'Phone' : 'Tablet'}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* App Info */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#A8A29E',
                      marginBottom: '8px',
                    }}
                  >
                    App Name
                  </label>
                  <input
                    type="text"
                    value={config.appName}
                    onChange={(e) => updateConfig({ appName: e.target.value })}
                    placeholder="My App"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #292524',
                      backgroundColor: '#0C0A09',
                      color: '#FFFFFF',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#A8A29E',
                      marginBottom: '8px',
                    }}
                  >
                    Bundle ID
                  </label>
                  <input
                    type="text"
                    value={config.bundleId}
                    onChange={(e) => updateConfig({ bundleId: e.target.value })}
                    placeholder="com.example.app"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #292524',
                      backgroundColor: '#0C0A09',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MobileBuildSelector;
