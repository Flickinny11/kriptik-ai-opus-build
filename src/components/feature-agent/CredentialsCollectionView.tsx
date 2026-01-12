/**
 * Credentials Collection View - Premium Edition
 *
 * A stunning, high-tech credential input interface that matches
 * the KripTik AI aesthetic:
 * - Frosted glass cards with 3D depth
 * - Smooth micro-animations
 * - Premium typography (Cal Sans / Outfit)
 * - Warm amber accents
 * - No purple, no emojis, no Lucide icons
 */

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RequiredCredential } from '@/store/useFeatureAgentTileStore';
import { OAuthConnectButton, requiresManualTokenEntry } from '../credentials/OAuthConnectButton';
import { GuidedCredentialEntry, hasGuidedSetup } from '../credentials/GuidedCredentialEntry';
import { useUserStore } from '@/store/useUserStore';
import './CredentialsCollectionView.css';
import '../credentials/GuidedCredentialEntry.css';

interface CredentialsCollectionViewProps {
  credentials: RequiredCredential[];
  onCredentialsSubmit: (credentials: Record<string, string>) => Promise<void> | void;
  projectId?: string;
}

// Custom external link icon
const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M6.2 3h6.8v6.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 3L7.2 8.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.6 3H4.3A1.3 1.3 0 0 0 3 4.3v7.4A1.3 1.3 0 0 0 4.3 13h7.4A1.3 1.3 0 0 0 13 11.7V9.4"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />
  </svg>
);

// Custom lock icon for secure fields
const SecureLockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
  </svg>
);

// Custom eye icons for show/hide
const EyeOpenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5z" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const EyeClosedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 3l18 18M10.5 10.677a2 2 0 0 0 2.823 2.823" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7.362 7.561C5.68 8.74 4.279 10.42 3 12.5c2.273 5.19 6.5 8 9 8 1.473 0 3.063-.56 4.562-1.527m2.577-2.134c.924-1.014 1.694-2.15 2.361-3.339C19.5 8 15.5 4.5 12 4.5c-.927 0-1.879.17-2.84.494" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Custom checkmark icon
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Custom key icon for platform
const KeyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M11 12l8-8m0 0l-1.5 3.5L21 9m-2-2l-3.5 1.5L14 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function isSecretName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('secret') || n.includes('token') || n.includes('key') || n.includes('password');
}

// Group credentials by platform
interface PlatformGroup {
  platform: string;
  platformUrl: string;
  credentials: RequiredCredential[];
  isComplete: boolean;
}

export function CredentialsCollectionView({ credentials, onCredentialsSubmit, projectId }: CredentialsCollectionViewProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [oauthErrors, setOauthErrors] = useState<Record<string, string>>({});
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const user = useUserStore((state) => state.user);

  const required = useMemo(() => credentials.filter((c) => c.required), [credentials]);
  const ready = useMemo(() => required.every((c) => (values[c.envVariableName] || '').trim().length > 0), [required, values]);
  const filledCount = useMemo(() =>
    credentials.filter(c => (values[c.envVariableName] || '').trim().length > 0).length
  , [credentials, values]);

  // Group credentials by platform for better UX
  const platformGroups = useMemo((): PlatformGroup[] => {
    const groups = new Map<string, PlatformGroup>();

    for (const cred of credentials) {
      const platform = cred.platformName || 'Other';
      if (!groups.has(platform)) {
        groups.set(platform, {
          platform,
          platformUrl: cred.platformUrl || '',
          credentials: [],
          isComplete: false,
        });
      }
      groups.get(platform)!.credentials.push(cred);
    }

    // Check if each group is complete
    for (const group of groups.values()) {
      group.isComplete = group.credentials.every(c =>
        (values[c.envVariableName] || '').trim().length > 0
      );
    }

    return Array.from(groups.values());
  }, [credentials, values]);

  const completedPlatforms = useMemo(() =>
    platformGroups.filter(g => g.isComplete).length
  , [platformGroups]);

  const toggleSecretVisibility = useCallback((key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleOAuthConnected = useCallback((credentialId: string, credentials: Record<string, string>) => {
    // Mark the credential as filled with OAuth placeholder
    setValues(prev => ({
      ...prev,
      ...credentials,
    }));
    setOauthErrors(prev => {
      const next = { ...prev };
      delete next[credentialId];
      return next;
    });
  }, []);

  const handleOAuthError = useCallback((credentialId: string, error: string) => {
    setOauthErrors(prev => ({ ...prev, [credentialId]: error }));
  }, []);

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {};
      for (const c of credentials) {
        const v = (values[c.envVariableName] || '').trim();
        if (v) payload[c.envVariableName] = v;
      }
      await onCredentialsSubmit(payload);
      setValues({});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="credentials-view">
      {/* Header */}
      <motion.div
        className="credentials-view__header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="credentials-view__header-icon">
          <SecureLockIcon />
        </div>
        <div className="credentials-view__header-text">
          <h3 className="credentials-view__title">Connect Your Services</h3>
          <p className="credentials-view__subtitle">
            {completedPlatforms}/{platformGroups.length} platforms • {filledCount}/{credentials.length} credentials
          </p>
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        className="credentials-view__progress-bar"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
      >
        <motion.div
          className="credentials-view__progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${(completedPlatforms / platformGroups.length) * 100}%` }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        />
      </motion.div>

      {/* Platform Tiles - Grouped by platform */}
      <div className="credentials-view__platform-grid">
        <AnimatePresence mode="sync">
          {platformGroups.map((group, groupIndex) => {
            const isExpanded = expandedPlatform === group.platform;
            const firstCred = group.credentials[0];

            return (
              <motion.div
                key={group.platform}
                className={`platform-tile ${group.isComplete ? 'platform-tile--complete' : ''} ${isExpanded ? 'platform-tile--expanded' : ''}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{
                  duration: 0.4,
                  delay: groupIndex * 0.08,
                  ease: [0.23, 1, 0.32, 1]
                }}
                layout
              >
                {/* Platform tile header - always visible */}
                <motion.div
                  className="platform-tile__header"
                  onClick={() => setExpandedPlatform(isExpanded ? null : group.platform)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="platform-tile__header-left">
                    <div className="platform-tile__icon">
                      <KeyIcon />
                    </div>
                    <div className="platform-tile__info">
                      <div className="platform-tile__name">{group.platform}</div>
                      <div className="platform-tile__count">
                        {group.credentials.filter(c => (values[c.envVariableName] || '').trim().length > 0).length}/{group.credentials.length} credentials
                      </div>
                    </div>
                  </div>

                  <div className="platform-tile__header-right">
                    {group.isComplete ? (
                      <div className="platform-tile__complete-badge">
                        <CheckIcon />
                        <span>Connected</span>
                      </div>
                    ) : user && firstCred && !requiresManualTokenEntry(group.platform) ? (
                      <OAuthConnectButton
                        credential={firstCred}
                        userId={user.id}
                        projectId={projectId}
                        onConnected={(creds) => {
                          // Apply credentials to all in this platform
                          group.credentials.forEach(c => {
                            if (creds[c.envVariableName]) {
                              handleOAuthConnected(c.envVariableName, creds);
                            }
                          });
                        }}
                        onError={(error) => handleOAuthError(firstCred.id, error)}
                      />
                    ) : requiresManualTokenEntry(group.platform) && hasGuidedSetup(group.platform) ? (
                      <span className="platform-tile__guide-badge">Step-by-step guide</span>
                    ) : null}

                    <motion.div
                      className="platform-tile__expand-icon"
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.div>
                  </div>
                </motion.div>

                {/* OAuth error display */}
                {firstCred && oauthErrors[firstCred.id] && (
                  <p className="platform-tile__error">{oauthErrors[firstCred.id]}</p>
                )}

                {/* Expanded credential inputs */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      className="platform-tile__credentials"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    >
                      {/* Show GuidedCredentialEntry for platforms with guides */}
                      {hasGuidedSetup(group.platform) ? (
                        <div className="platform-tile__guided-entry">
                          <GuidedCredentialEntry
                            platformName={group.platform}
                            requiredEnvVars={group.credentials.map(c => c.envVariableName)}
                            onCredentialsSubmit={(creds) => {
                              // Apply all credentials from guided entry
                              Object.entries(creds).forEach(([key, value]) => {
                                setValues(prev => ({ ...prev, [key]: value }));
                              });
                            }}
                          />
                        </div>
                      ) : (
                        <div className="platform-tile__credentials-inner">
                          {group.platformUrl && (
                            <a
                              href={group.platformUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="platform-tile__platform-link"
                            >
                              <span>Get credentials from {group.platform}</span>
                              <ExternalLinkIcon />
                            </a>
                          )}

                          {group.credentials.map((c) => {
                            const v = values[c.envVariableName] ?? '';
                            const filled = v.trim().length > 0;
                            const isSecret = isSecretName(c.envVariableName) || isSecretName(c.name);
                            const showingSecret = showSecrets[c.envVariableName];
                            const isFocused = focusedField === c.envVariableName;

                            return (
                              <div key={c.id} className="credential-field">
                                <label className="credential-field__label">
                                  <span className="credential-field__name">{c.name}</span>
                                  {c.required && <span className="credential-field__required">*</span>}
                                </label>
                                <div className="credential-field__env">{c.envVariableName}</div>

                                <div className={`credential-field__input-wrapper ${isFocused ? 'credential-field__input-wrapper--focused' : ''}`}>
                                  <input
                                    type={isSecret && !showingSecret ? 'password' : 'text'}
                                    value={v}
                                    onChange={(e) => setValues((prev) => ({ ...prev, [c.envVariableName]: e.target.value }))}
                                    onFocus={() => setFocusedField(c.envVariableName)}
                                    onBlur={() => setFocusedField(null)}
                                    placeholder={isSecret ? '••••••••••••••••' : 'Enter value...'}
                                    className="credential-field__input"
                                    autoComplete="off"
                                    spellCheck={false}
                                  />

                                  <div className="credential-field__actions">
                                    {isSecret && (
                                      <button
                                        type="button"
                                        onClick={() => toggleSecretVisibility(c.envVariableName)}
                                        className="credential-field__toggle"
                                        title={showingSecret ? 'Hide' : 'Show'}
                                      >
                                        {showingSecret ? <EyeOpenIcon /> : <EyeClosedIcon />}
                                      </button>
                                    )}

                                    <AnimatePresence>
                                      {filled && (
                                        <motion.div
                                          className="credential-field__check"
                                          initial={{ scale: 0, opacity: 0 }}
                                          animate={{ scale: 1, opacity: 1 }}
                                          exit={{ scale: 0, opacity: 0 }}
                                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                        >
                                          <CheckIcon />
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 3D edge effects */}
                <div className="platform-tile__edge-right" />
                <div className="platform-tile__edge-bottom" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Submit button */}
      <motion.div
        className="credentials-view__footer"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <motion.button
          onClick={submit}
          disabled={!ready || submitting}
          className={`credentials-view__submit ${ready ? 'credentials-view__submit--ready' : ''} ${submitting ? 'credentials-view__submit--loading' : ''}`}
          whileHover={ready ? { scale: 1.02, y: -2 } : {}}
          whileTap={ready ? { scale: 0.98, y: 0 } : {}}
        >
          <span className="credentials-view__submit-text">
            {submitting ? 'Securing Credentials...' : ready ? 'Continue Building' : `${required.length - filledCount} more required`}
          </span>
          {ready && !submitting && (
            <motion.span
              className="credentials-view__submit-arrow"
              initial={{ x: -5, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              →
            </motion.span>
          )}
          {submitting && (
            <motion.span
              className="credentials-view__submit-spinner"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              ⟳
            </motion.span>
          )}
        </motion.button>

        <p className="credentials-view__security-note">
          Your credentials are encrypted and never leave your account
        </p>
      </motion.div>
    </div>
  );
}
