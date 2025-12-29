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
import './CredentialsCollectionView.css';

interface CredentialsCollectionViewProps {
  credentials: RequiredCredential[];
  onCredentialsSubmit: (credentials: Record<string, string>) => Promise<void> | void;
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

export function CredentialsCollectionView({ credentials, onCredentialsSubmit }: CredentialsCollectionViewProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const required = useMemo(() => credentials.filter((c) => c.required), [credentials]);
  const ready = useMemo(() => required.every((c) => (values[c.envVariableName] || '').trim().length > 0), [required, values]);
  const filledCount = useMemo(() => 
    credentials.filter(c => (values[c.envVariableName] || '').trim().length > 0).length
  , [credentials, values]);

  const toggleSecretVisibility = useCallback((key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
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
          <h3 className="credentials-view__title">Secure Credentials</h3>
          <p className="credentials-view__subtitle">
            {filledCount}/{credentials.length} configured • Stored with AES-256 encryption
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
          animate={{ width: `${(filledCount / credentials.length) * 100}%` }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        />
      </motion.div>

      {/* Credential Cards */}
      <div className="credentials-view__cards">
        <AnimatePresence mode="sync">
          {credentials.map((c, index) => {
            const v = values[c.envVariableName] ?? '';
            const filled = v.trim().length > 0;
            const isSecret = isSecretName(c.envVariableName) || isSecretName(c.name);
            const showingSecret = showSecrets[c.envVariableName];
            const isFocused = focusedField === c.envVariableName;

            return (
              <motion.div
                key={c.id}
                className={`credential-card ${filled ? 'credential-card--filled' : ''} ${c.required && !filled ? 'credential-card--required' : ''} ${isFocused ? 'credential-card--focused' : ''}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.05,
                  ease: [0.23, 1, 0.32, 1] 
                }}
                whileHover={{ scale: 1.01, y: -2 }}
              >
                {/* Card inner glow */}
                <div className="credential-card__glow" />
                
                {/* Card content */}
                <div className="credential-card__content">
                  <div className="credential-card__header">
                    <div className="credential-card__header-left">
                      <div className="credential-card__icon">
                        <KeyIcon />
                      </div>
                      <div className="credential-card__info">
                        <div className="credential-card__name">
                          {c.name}
                          {c.required && (
                            <span className="credential-card__required-badge">Required</span>
                          )}
                        </div>
                        <div className="credential-card__env-var">{c.envVariableName}</div>
                      </div>
                    </div>
                    
                    {c.platformUrl && (
                      <a
                        href={c.platformUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="credential-card__platform-link"
                        title={`Get from ${c.platformName}`}
                      >
                        <span>Get Key</span>
                        <ExternalLinkIcon />
                      </a>
                    )}
                  </div>

                  {c.description && (
                    <p className="credential-card__description">{c.description}</p>
                  )}

                  <div className="credential-card__input-container">
                    <div className={`credential-card__input-wrapper ${isFocused ? 'credential-card__input-wrapper--focused' : ''}`}>
                      <input
                        type={isSecret && !showingSecret ? 'password' : 'text'}
                        value={v}
                        onChange={(e) => setValues((prev) => ({ ...prev, [c.envVariableName]: e.target.value }))}
                        onFocus={() => setFocusedField(c.envVariableName)}
                        onBlur={() => setFocusedField(null)}
                        placeholder={isSecret ? '••••••••••••••••' : 'Enter value...'}
                        className="credential-card__input"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      
                      <div className="credential-card__input-actions">
                        {isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleSecretVisibility(c.envVariableName)}
                            className="credential-card__toggle-btn"
                            title={showingSecret ? 'Hide' : 'Show'}
                          >
                            {showingSecret ? <EyeOpenIcon /> : <EyeClosedIcon />}
                          </button>
                        )}
                        
                        <AnimatePresence>
                          {filled && (
                            <motion.div
                              className="credential-card__check"
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
                </div>

                {/* 3D edge effects */}
                <div className="credential-card__edge-right" />
                <div className="credential-card__edge-bottom" />
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
